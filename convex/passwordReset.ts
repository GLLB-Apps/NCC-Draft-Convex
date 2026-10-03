import { v } from 'convex/values'
import { action, internalMutation, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { sendMail } from './lib/mail'

// Egen tokendesign, porterad rakt av från server/lib/Auth.php
// (requestPasswordReset/resetPassword) — SHA-256-hash av token lagras, aldrig
// den riktiga token, 30 min TTL, max 3 förfrågningar/15 min/konto, loggar ut
// alla sessioner vid lyckad återställning. Medvetet INTE Convex Auths egna
// återställningsflöde (se MIGRATION_PLAN.md §3) — AdminResetPassword.tsx
// förväntar sig exakt denna token-i-länk-form.
const RESET_TTL_MIN = 30
const RESET_MAX_PER_WINDOW = 3

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const findUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.toLowerCase().trim()
    return await ctx.db.query('users').withIndex('email', q => q.eq('email', normalized)).unique()
  },
})

export const createResetToken = internalMutation({
  args: { userId: v.id('users'), tokenHash: v.string() },
  handler: async (ctx, { userId, tokenHash }) => {
    const now = new Date()
    const since = new Date(now.getTime() - 15 * 60_000).toISOString()
    const recent = (await ctx.db.query('passwordResets').withIndex('user_id', q => q.eq('user_id', userId)).collect())
      .filter(r => r.created_at > since)
    if (recent.length >= RESET_MAX_PER_WINDOW) return false

    await ctx.db.insert('passwordResets', {
      token_hash: tokenHash, user_id: userId,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + RESET_TTL_MIN * 60_000).toISOString(),
    })
    return true
  },
})

/** Begär en återställningslänk. Avslöjar ALDRIG om kontot finns — anroparen svarar alltid likadant. */
export const request = action({
  args: { email: v.string(), siteUrl: v.string() },
  handler: async (ctx, { email, siteUrl }) => {
    const user = await ctx.runQuery(internal.passwordReset.findUserByEmail, { email })
    if (user === null) return // tyst — ingen token skapas, inget mejl skickas

    const token = randomToken()
    const tokenHash = await sha256Hex(token)
    const created = await ctx.runMutation(internal.passwordReset.createResetToken, { userId: user._id, tokenHash })
    if (!created) return // rate-limiterad — samma tysta svar

    const link = `${siteUrl}/admin/aterstall-losenord?token=${token}`
    const sent = await sendMail({
      to: user.email, subject: 'Återställ lösenord',
      text: `Klicka på länken för att välja ett nytt lösenord (gäller i ${RESET_TTL_MIN} minuter):\n\n${link}\n`,
    })
    // Svaret till klienten får ALDRIG skilja på lyckat/misslyckat utskick
    // (avslöjar annars indirekt om kontot finns) — men tystnaden fick
    // tidigare även en riktig leveransmiss att försvinna spårlöst. Loggas nu
    // istället, synligt i `npx convex logs`/dashboarden.
    if (!sent) console.error(`[passwordReset] sendMail misslyckades för ${user.email}`)
  },
})

export const findValidToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const row = await ctx.db.query('passwordResets').withIndex('token_hash', q => q.eq('token_hash', tokenHash)).unique()
    if (row === null || row.used_at !== undefined) return null
    if (new Date(row.expires_at) < new Date()) return null
    return row
  },
})

export const consumeToken = internalMutation({
  args: { resetId: v.id('passwordResets'), userId: v.id('users') },
  handler: async (ctx, { resetId, userId }) => {
    await ctx.db.patch(resetId, { used_at: new Date().toISOString() })
    // Loggar ut alla befintliga sessioner — ett läckt lösenord ska inte kunna
    // fortsätta användas via en session som redan var öppen innan återställningen.
    // OVERIFIERAT (se MIGRATION_PLAN.md §6): antar att @convex-dev/auth's
    // authTables innehåller en 'authSessions'-tabell med fältet userId och ett
    // index med samma namn — verifiera mot det faktiska genererade schemat
    // (convex/_generated/dataModel.d.ts) i Fas 1 och justera tabell-/
    // fältnamnen om de skiljer sig.
    const sessions = await ctx.db.query('authSessions').withIndex('userId', q => q.eq('userId', userId)).collect()
    for (const s of sessions) await ctx.db.delete(s._id)
  },
})

/** Sätter nytt lösenord via en giltig, oanvänd, icke-utgången token. */
export const reset = action({
  args: { token: v.string(), password: v.string() },
  handler: async (ctx, { token, password }) => {
    if (password.length < 8) return false
    const tokenHash = await sha256Hex(token)
    const row = await ctx.runQuery(internal.passwordReset.findValidToken, { tokenHash })
    if (row === null) return false

    // internal.users.setPasswordCredential, INTE api.users.setPassword — den
    // senare kräver superadmin, men den som återställer sitt eget lösenord
    // här är inte ens inloggad. Giltig token ÄR auktoriseringen.
    await ctx.runAction(internal.users.setPasswordCredential, { userId: row.user_id, password })
    await ctx.runMutation(internal.passwordReset.consumeToken, { resetId: row._id, userId: row.user_id })
    return true
  },
})
