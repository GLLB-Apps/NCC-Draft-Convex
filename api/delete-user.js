// Vercel serverless function: raderar ett konto som ännu inte fått någon nivå.
//
// Registreringen är öppen, så skräp- och testkonton samlas i "Väntar på nivå".
// Att ta bort dem kräver serverns API-nyckel — ett konto går inte att radera
// från klienten.
//
// Tre spärrar, i den här ordningen:
//   1. anroparen måste vara superadmin
//   2. ingen kan radera sig själv
//   3. kontot får INTE ha någon roll, medlemsrad eller åtkomstlabel
//
// Den tredje är den viktiga: endpointen ska inte gå att använda för att radera
// en kollega. Har kontot åtkomst måste den först tas bort i gränssnittet, och
// då blir kontot "otilldelat" — ett medvetet extra steg.
//
// Idempotent: rader och konto som redan är borta hoppas över, så en andra
// körning svarar ok i stället för att fela.
import { Client, Account, Databases, Users, Query } from 'node-appwrite'

const ACCESS_LABELS = ['admin', 'member', 'viewer']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const { userId } = body
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()

  if (!jwt) return res.status(401).json({ error: 'Saknar token' })
  if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'userId krävs' })

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
  if (callerId === userId) return res.status(400).json({ error: 'Du kan inte radera ditt eget konto' })

  const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)
  const databases = new Databases(adminClient)
  const users = new Users(adminClient)

  // 2) Bara superadmin.
  try {
    const roles = await databases.listDocuments({
      databaseId: DB, collectionId: 'user_roles', queries: [Query.equal('user_id', callerId)],
    })
    if (roles.documents[0]?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Endast superadministratörer kan radera konton' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 3) Kontot måste sakna åtkomst. Kollar alla tre spåren, inte bara ett.
  try {
    const [roleRows, memberRows] = await Promise.all([
      databases.listDocuments({ databaseId: DB, collectionId: 'user_roles', queries: [Query.equal('user_id', userId)] }),
      databases.listDocuments({ databaseId: DB, collectionId: 'intranet_members', queries: [Query.equal('user_id', userId)] }),
    ])
    let labels = []
    try { labels = (await users.get({ userId })).labels || [] } catch (e) { if (e?.code !== 404) throw e }

    const harÅtkomst = roleRows.total > 0 || memberRows.total > 0 || labels.some(l => ACCESS_LABELS.includes(l))
    if (harÅtkomst) {
      return res.status(409).json({ error: 'Kontot har en behörighet. Ta bort åtkomsten först, sedan går kontot att radera.' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 4) Radera. 404 betyder att raden redan var borta – inget att larma om.
  const ignore404 = async fn => {
    try { await fn() } catch (e) { if (e?.code !== 404) throw e }
  }
  try {
    await ignore404(() => databases.deleteDocument({ databaseId: DB, collectionId: 'profiles', documentId: userId }))
    await ignore404(() => users.delete({ userId }))
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
