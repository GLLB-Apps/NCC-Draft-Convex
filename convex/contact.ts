import { v } from 'convex/values'
import { action, internalMutation } from './_generated/server'
import { api, internal } from './_generated/api'
import { sendMail } from './lib/mail'

// Publik endpoint för kontaktformuläret — motsvarar server/api/contact.php.
// En action (inte en mutation) eftersom den kan behöva skicka e-post
// (utgående fetch). Sparar alltid i contactMessages utom när e-post är det
// ENDA sättet OCH lyckades — annars försvinner meddelandet om utskicket
// misslyckas (samma gren som ContactController::submit).
export const submit = action({
  args: { name: v.string(), email: v.string(), subject: v.optional(v.string()), message: v.string(), website: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Honeypot: dolt fält för besökare, ofta ifyllt av botar. Låtsas lyckas.
    if (args.website && args.website.trim() !== '') return { sent: true }

    const name = args.name.trim()
    const email = args.email.trim()
    const subject = (args.subject ?? '').trim()
    const message = args.message.trim()
    if (name === '' || email === '' || message === '' || !email.includes('@')) {
      throw new Error('Namn, giltig e-post och meddelande krävs.')
    }

    const settingsRows = await ctx.runQuery(api.siteSettings.list, {})
    const settings = (settingsRows[0] ?? {}) as Record<string, unknown>
    const delivery = (settings.contact_delivery as string | undefined) ?? 'system'

    let emailSent = false
    if (delivery === 'email' || delivery === 'both') {
      const to = (settings.contact_recipient as string | undefined) ?? (settings.contact_email as string | undefined)
      if (to) {
        const from = (settings.contact_from as string | undefined) || undefined
        emailSent = await sendMail({
          to, subject: subject || 'Meddelande från kontaktformuläret',
          text: `Från: ${name} <${email}>\n\n${message}`, replyTo: email, from,
        })
      }
    }

    if (delivery !== 'email' || !emailSent) {
      await ctx.runMutation(internal.contact.save, { name, email, subject, message })
    }
    return { sent: true }
  },
})

export const save = internalMutation({
  args: { name: v.string(), email: v.string(), subject: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    const now = new Date().toISOString()
    await ctx.db.insert('contactMessages', { ...args, status: 'unread', created_at: now, updated_at: now })
  },
})
