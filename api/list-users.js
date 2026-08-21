// Vercel serverless function: hämtar kontonas e-postadresser till Användare.
//
// Adresserna bor i Appwrites konton, inte i någon kollektion, och går bara att
// läsa med serverns API-nyckel. De läggs medvetet INTE i `profiles` — den är
// läsbar för alla inloggade, och en adresslista hör inte hemma där.
//
// Anroparen bevisar sig med en kortlivad JWT och måste vara superadmin, samma
// gräns som för att ändra åtkomst och lösenord.
import { Client, Account, Databases, Users, Query } from 'node-appwrite'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte.' })

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return res.status(401).json({ error: 'Saknar token' })

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

  const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)

  // 2) Bara superadmin får se listan.
  try {
    const roles = await new Databases(adminClient).listDocuments({
      databaseId: DB, collectionId: 'user_roles', queries: [Query.equal('user_id', callerId)],
    })
    if (roles.documents[0]?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Endast superadministratörer kan se e-postadresserna' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 3) Id → e-post. Inget annat följer med.
  try {
    const list = await new Users(adminClient).list({ queries: [Query.limit(500)] })
    const emails = {}
    for (const u of list.users) emails[u.$id] = u.email || null
    return res.status(200).json({ emails })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
