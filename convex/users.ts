import { v } from 'convex/values'
import { query, mutation, action, internalAction, internalQuery } from './_generated/server'
import { api, internal } from './_generated/api'
import { requireUser, requireSuperadmin, currentUser, isAdmin, isMember, canWriteIntranet } from './lib/permissions'
import { ConvexError } from 'convex/values'
import { sendMail } from './lib/mail'

// Användarhantering + den sammanslagna "profiles/user_roles/intranet_members"-
// ersättningen (se schema.ts: alla tre Appwrite-kollektioner är bara fält på
// users-dokumentet här). Motsvarar server/api/users.php + UserCollections.php.

/**
 * Den inloggades egen status — ersätter auth.tsx's tre separata fetchRole/
 * fetchMember/fetchDisplayName-anrop med en query. null om inte inloggad.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx)
    if (user === null) return null
    return {
      id: user._id,
      email: user.email,
      role: user.role ?? null,
      displayName: user.display_name ?? null,
      isAdmin: isAdmin(user),
      isMember: isMember(user),
      canWriteIntranet: canWriteIntranet(user),
      intranetReadOnly: user.intranet_read_only === true,
    }
  },
})

/** "profiles"-virtuella tabellens läsning (se src/lib/supabase.ts: table === 'profiles'). */
export const getProfile = query({
  args: { id: v.id('users') },
  handler: async (ctx, { id }) => {
    const user = await ctx.db.get(id)
    if (user === null) return null
    return {
      id: user._id, display_name: user.display_name ?? null, intro: user.intro ?? null,
      notifications_seen: user.notifications_seen ?? {}, notifications_cleared_at: user.notifications_cleared_at ?? null,
    }
  },
})

/**
 * Sätter presentation på ett ännu inte aktiverat konto, direkt efter
 * självregistrering (AdminLogin.tsx "Skapa konto") — ingen session finns än
 * vid detta anrop. Vägrar om kontot redan fått åtkomst, precis som PHP:s
 * Auth::updatePendingProfile (WHERE role IS NULL AND intranet_member = 0).
 */
export const setPendingProfile = mutation({
  args: { id: v.id('users'), display_name: v.optional(v.string()), intro: v.optional(v.string()) },
  handler: async (ctx, { id, display_name, intro }) => {
    const user = await ctx.db.get(id)
    if (user === null || user.role !== undefined || user.intranet_member === true) return false
    await ctx.db.patch(id, { display_name, intro })
    return true
  },
})

/** Den inloggades egen profil (notifikationer m.m.) — intranetNotifications.tsx/notifications.tsx. */
export const updateProfile = mutation({
  args: {
    display_name: v.optional(v.string()), intro: v.optional(v.string()),
    notifications_seen: v.optional(v.record(v.string(), v.string())),
    notifications_cleared_at: v.optional(v.string()),
  },
  handler: async (ctx, patch) => {
    const user = await requireUser(ctx)
    await ctx.db.patch(user._id, patch)
    return true
  },
})

/**
 * Alla konton med fälten AdminAdmins.tsx behöver — role/intranet_member/
 * intranet_read_only/display_name/intro/email ligger redan direkt på SAMMA
 * dokument (se schema.ts), så till skillnad från Appwrite-/PHP-versionen
 * (tre separata tabeller: user_roles/profiles/intranet_members, plus en egen
 * /api/list-users-adressuppslagning) behövs ingen join och inget separat
 * e-postanrop — allt kommer i en enda query. Superadmin-enbart.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx)
    const users = await ctx.db.query('users').collect()
    return users.map(u => ({
      id: u._id, email: u.email, role: u.role ?? null,
      display_name: u.display_name ?? null, intro: u.intro ?? null,
      intranet_member: u.intranet_member === true, intranet_read_only: u.intranet_read_only === true,
      created_at: new Date(u._creationTime).toISOString(),
    }))
  },
})

/** GET-motsvarighet: {id: email} för alla konton. Superadmin-enbart. */
export const emails = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperadmin(ctx)
    const users = await ctx.db.query('users').collect()
    const map: Record<string, string> = {}
    for (const u of users) map[u._id] = u.email
    return map
  },
})

/** Sätter en användares admin-roll och/eller intranätsåtkomst. Superadmin-enbart. */
export const setAccess = mutation({
  args: {
    userId: v.id('users'),
    role: v.optional(v.union(v.literal('superadmin'), v.literal('redaktor'), v.literal('skribent'), v.null())),
    intranet_member: v.optional(v.boolean()),
    intranet_read_only: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, role, ...rest }) => {
    await requireSuperadmin(ctx)
    const patch: Record<string, unknown> = { ...rest }
    if (role !== undefined) patch.role = role ?? undefined
    await ctx.db.patch(userId, patch)
    return true
  },
})

/**
 * Raderar ett konto — men bara om det INTE redan har åtkomst (knappen är till
 * för att rensa väntande/avvisade självregistreringar, inte för att radera en
 * kollega). Samma spärr som PHP:s UsersController::delete.
 */
export const deleteUser = mutation({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    await requireSuperadmin(ctx)
    const target = await ctx.db.get(userId)
    if (target === null) throw new ConvexError({ code: 'NOT_FOUND', message: 'Kontot finns inte.' })
    if (target.role !== undefined || target.intranet_member === true) {
      throw new ConvexError({ code: 'FORBIDDEN', message: 'Kontot har åtkomst och kan inte raderas här.' })
    }
    await ctx.db.delete(userId)
    return true
  },
})

// setPassword/sendPassword (superadmin sätter/mejlar ett annat kontos
// lösenord, motsvarande server/api/users.php setPassword/sendPassword)
// använder `modifyAccountCredentials` från '@convex-dev/auth/server' — nu
// VERIFIERAD mot den riktiga genererade typen (`tsc` i `npx convex dev`
// avslöjade i Fas 1 att den kräver en ActionCtx, inte en MutationCtx — ctx.db
// finns inte i en action, så behörighetskontrollen och e-postuppslaget går
// via ctx.runQuery istället för direkt ctx.db-åtkomst).
import { modifyAccountCredentials } from '@convex-dev/auth/server'

/**
 * Den faktiska credential-skrivningen, UTAN egen behörighetskontroll — den
 * måste redan ha skett hos anroparen. Två helt olika auktoriseringsvägar
 * litar på den här: setPassword nedan (superadmin-kontroll) OCH
 * passwordReset.ts: reset (giltig återställnings-token, ingen inloggning
 * alls). Att lägga superadmin-kravet HÄR skulle av misstag blockera den
 * självbetjänade återställningen — upptäckt och fixat i Fas 1.
 */
export const setPasswordCredential = internalAction({
  args: { userId: v.id('users'), password: v.string() },
  handler: async (ctx, { userId, password }) => {
    // INTE api.users.emails — den är superadmin-gated, och återställnings-
    // flödet (passwordReset.ts) har ingen inloggad användare alls. Denna
    // interna, ogrindade uppslagning är säker just för att hela filen bara
    // är nåbar från annan serverkod, aldrig direkt från klienten.
    const email = await ctx.runQuery(internal.users.emailById, { userId })
    if (!email) throw new ConvexError({ code: 'NOT_FOUND', message: 'Kontot finns inte.' })
    await modifyAccountCredentials(ctx, { provider: 'password', account: { id: email, secret: password } })
  },
})

export const emailById = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => (await ctx.db.get(userId))?.email ?? null,
})

/** Superadmin sätter ett ANNAT kontos lösenord — AdminAdmins.tsx. */
export const setPassword = action({
  args: { userId: v.id('users'), password: v.string() },
  handler: async (ctx, { userId, password }) => {
    const me = await ctx.runQuery(api.users.me, {})
    if (me === null || me.role !== 'superadmin') throw new ConvexError({ code: 'FORBIDDEN', message: 'Kräver superadmin.' })
    if (password.length < 8) throw new ConvexError({ code: 'VALIDATION_ERROR', message: 'Lösenordet måste vara minst 8 tecken.' })
    await ctx.runAction(internal.users.setPasswordCredential, { userId, password })
    return true
  },
})

/**
 * Sätter OCH mejlar samma lösenord till kontots adress — en action eftersom
 * den behöver göra ett utgående fetch-anrop (Resend). Motsvarar
 * UsersController::sendPassword i PHP-versionen.
 */
export const sendPassword = action({
  args: { userId: v.id('users'), password: v.string() },
  handler: async (ctx, { userId, password }) => {
    const target = await ctx.runQuery(api.users.getProfile, { id: userId })
    if (target === null) throw new ConvexError({ code: 'NOT_FOUND', message: 'Kontot finns inte.' })
    await ctx.runAction(api.users.setPassword, { userId, password })

    const name = target.display_name?.trim() || 'du'
    const emails = await ctx.runQuery(api.users.emails, {})
    const email = emails[userId]
    const sent = await sendMail({
      to: email, subject: 'Nytt lösenord',
      text: `Hej ${name},\n\nEtt nytt lösenord har skapats åt ditt konto: ${password}\n\nLogga in och byt det till ett eget så snart du kan.\n`,
    })
    if (!sent) throw new ConvexError({ code: 'SEND_FAILED', message: 'Lösenordet sattes, men mejlet kunde inte skickas. Använd "Byt lösenord" i stället.' })
    return true
  },
})
