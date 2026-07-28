// Vercel serverless function: sätter en användares ÅTKOMSTLABEL efter nivå.
// Labels kan bara sättas med serverns API-nyckel, så en databasrad räcker inte
// som säkerhetsgräns — labeln är gränsen.
//
//   access 'admin'  → label "admin"  (skriver innehåll + intranät)
//   access 'member' → label "member" (skriver i intranätet)
//   access 'viewer' → label "viewer" (läser intranätet, kan inte ändra)
//   access 'none'   → varken eller
//
// Endast åtkomstlabels rörs; ev. andra labels bevaras. Anroparen bevisar sig
// med en kortlivad JWT och måste vara superadmin.
import { Client, Account, Databases, Users, Query } from 'node-appwrite'

const ACCESS_LABELS = ['admin', 'member', 'viewer']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { userId, access } = body
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()

  if (!jwt) return res.status(401).json({ error: 'Saknar token' })
  if (!userId || !['admin', 'member', 'viewer', 'none'].includes(access)) {
    return res.status(400).json({ error: 'userId och access ("admin"/"member"/"viewer"/"none") krävs' })
  }

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT
  const project = process.env.VITE_APPWRITE_PROJECT_ID
  const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'

  // 1) Vem anropar? Verifiera JWT med anroparens egen klient.
  let callerId
  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt)
    callerId = (await new Account(userClient).get()).$id
  } catch {
    return res.status(401).json({ error: 'Ogiltig eller utgången session' })
  }

  const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)

  // 2) Bekräfta att anroparen är superadmin.
  try {
    const roles = await new Databases(adminClient).listDocuments({
      databaseId: DB, collectionId: 'user_roles', queries: [Query.equal('user_id', callerId)],
    })
    if (roles.documents[0]?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Endast superadministratörer kan ändra åtkomst' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 3) Byt bara åtkomstlabels; bevara ev. andra.
  try {
    const users = new Users(adminClient)
    const current = (await users.get({ userId })).labels || []
    const base = current.filter(l => !ACCESS_LABELS.includes(l))
    const add = access === 'none' ? [] : [access]
    const next = [...base, ...add]
    await users.updateLabels({ userId, labels: next })
    return res.status(200).json({ ok: true, labels: next })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
