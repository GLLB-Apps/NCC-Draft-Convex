// Vercel serverless function: lets a superadmin set another user's password.
// The caller proves who they are with a short-lived Appwrite JWT (verified with
// their own client), and we confirm they are a superadmin before using the
// server API key to update the target user's password.
import { Client, Account, Databases, Users, Query } from 'node-appwrite'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { userId, password } = body
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()

  if (!jwt) return res.status(401).json({ error: 'Saknar token' })
  if (!userId || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'userId och lösenord (minst 8 tecken) krävs' })
  }

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT
  const project = process.env.VITE_APPWRITE_PROJECT_ID
  const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'

  // 1) Who is calling? Verify the JWT with the user's own client.
  let callerId
  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt)
    const me = await new Account(userClient).get()
    callerId = me.$id
  } catch {
    return res.status(401).json({ error: 'Ogiltig eller utgången session' })
  }

  // 2) Server client (API key) — confirm the caller is a superadmin.
  const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)
  try {
    const roles = await new Databases(adminClient).listDocuments({
      databaseId: DB, collectionId: 'user_roles', queries: [Query.equal('user_id', callerId)],
    })
    if (roles.documents[0]?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Endast superadministratörer kan ändra andras lösenord' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 3) Update the target user's password.
  try {
    await new Users(adminClient).updatePassword({ userId, password })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
