// Vercel serverless function: tar emot kontaktformuläret och levererar det efter
// inställningen `contact_delivery` i site_settings:
//   'system' → sparar i contact_messages (syns i admin › Meddelanden)
//   'email'  → mejlar via Resend till contact_recipient (RESEND_API_KEY krävs)
//   'both'   → båda
// API-nyckeln ligger som miljövariabel i Vercel (RESEND_API_KEY) och exponeras
// aldrig i klienten. Faller tillbaka på system-sparning om e-post inte är
// konfigurerad, så inget meddelande tappas.
import { Client, Databases, Query, ID } from 'node-appwrite'
import { Resend } from 'resend'

const DEFAULT_FROM = 'Kontaktformulär <onboarding@resend.dev>'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { name, email, subject, message, website } = body

  // Honeypot: fylld = bot. Svara ok utan att göra något.
  if (website) return res.status(200).json({ success: true })

  if ([name, email, message].some(v => typeof v !== 'string') || !name.trim() || !email.trim() || !message.trim()) {
    return res.status(400).json({ error: 'Namn, e-post och meddelande krävs.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Ogiltig e-postadress.' })
  }

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT
  const project = process.env.VITE_APPWRITE_PROJECT_ID
  const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'
  const admin = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)
  const databases = new Databases(admin)

  // Läs leveransinställningen server-side (switchen är auktoritativ här).
  let delivery = 'system'
  let recipient = null
  let from = DEFAULT_FROM
  try {
    const s = (await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings', queries: [Query.limit(1)] })).documents[0]
    if (s) {
      delivery = ['system', 'email', 'both'].includes(s.contact_delivery) ? s.contact_delivery : 'system'
      recipient = (s.contact_recipient || s.contact_email || '').trim() || null
      from = (s.contact_from || '').trim() || DEFAULT_FROM
    }
  } catch { /* faller tillbaka på standard */ }

  const wantEmail = delivery === 'email' || delivery === 'both'
  const emailConfigured = !!process.env.RESEND_API_KEY && !!recipient
  // Om e-post begärts men inte är konfigurerad → spara i systemet ändå.
  const wantSystem = delivery === 'system' || delivery === 'both' || (wantEmail && !emailConfigured)

  let saved = false
  let mailed = false
  const errors = []

  if (wantSystem) {
    try {
      await databases.createDocument({
        databaseId: DB, collectionId: 'contact_messages', documentId: ID.unique(),
        data: { name: name.trim(), email: email.trim(), subject: (subject || '').trim(), message: message.trim(), status: 'unread' },
      })
      saved = true
    } catch (e) { errors.push('system: ' + (e?.message || e)) }
  }

  if (wantEmail && emailConfigured) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const result = await resend.emails.send({
        from,
        to: [recipient],
        replyTo: email.trim(),
        subject: subject?.trim() ? `Kontakt: ${subject.trim()}` : `Nytt meddelande från ${name.trim()}`,
        text: `Namn: ${name.trim()}\nE-post: ${email.trim()}${subject?.trim() ? `\nÄmne: ${subject.trim()}` : ''}\n\nMeddelande:\n${message.trim()}`,
      })
      if (result?.error) throw new Error(result.error.message || 'Resend-fel')
      mailed = true
    } catch (e) { errors.push('email: ' + (e?.message || e)) }
  }

  if (!saved && !mailed) {
    console.error('Kontaktformulär misslyckades:', errors.join(' | '))
    return res.status(500).json({ error: 'Meddelandet kunde inte tas emot.' })
  }
  return res.status(200).json({ success: true, saved, mailed })
}
