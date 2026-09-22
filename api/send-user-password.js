// Vercel serverless function: sätter en användares lösenord (som
// set-user-password.js) och mejlar samma lösenord till personen via Resend.
// Kräver RESEND_API_KEY (samma miljövariabel som contact.js redan använder).
import { Client, Account, Databases, Users, Query } from 'node-appwrite'
import { Resend } from 'resend'

const DEFAULT_FROM = 'Rögleskogen <onboarding@resend.dev>'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { userId, password } = body
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()

  if (!jwt) return res.status(401).json({ error: 'Saknar token' })
  if (!userId || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'userId och lösenord (minst 8 tecken) krävs' })
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'E-postutskick är inte konfigurerat (RESEND_API_KEY saknas)' })
  }

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT
  const project = process.env.VITE_APPWRITE_PROJECT_ID
  const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'

  // 1) Vem anropar?
  let callerId
  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt)
    callerId = (await new Account(userClient).get()).$id
  } catch {
    return res.status(401).json({ error: 'Ogiltig eller utgången session' })
  }

  // 2) Server client (API-nyckel) — bara superadmin får mejla lösenord.
  const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)
  try {
    const roles = await new Databases(adminClient).listDocuments({
      databaseId: DB, collectionId: 'user_roles', queries: [Query.equal('user_id', callerId)],
    })
    if (roles.documents[0]?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Endast superadministratörer kan mejla andras lösenord' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 3) Sätt lösenordet och hämta mottagarens adress.
  const users = new Users(adminClient)
  let targetEmail
  try {
    targetEmail = (await users.get({ userId })).email
    await users.updatePassword({ userId, password })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
  if (!targetEmail) return res.status(500).json({ error: 'Kontot saknar e-postadress' })

  // 4) Mejla det nya lösenordet.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to: [targetEmail],
      subject: 'Ditt lösenord har uppdaterats',
      text: `Hej!\n\nEn administratör har satt ett nytt lösenord för ditt konto på Rögleskogens adminpanel:\n\n${password}\n\nLogga in på /admin/login och byt gärna lösenordet igen när du loggat in.`,
    })
    if (result?.error) throw new Error(result.error.message || 'Resend-fel')
  } catch (e) {
    // Lösenordet är redan satt — det vore fel att låtsas att ingenting hände.
    return res.status(500).json({ error: 'Lösenordet uppdaterades men kunde inte mejlas: ' + (e?.message || e) })
  }

  return res.status(200).json({ ok: true })
}
