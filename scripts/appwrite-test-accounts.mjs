// Skapar testkonton för att prova in-/utloggning och panelerna:
//   Skribent, Redaktör (admin-panelen) och Intranät (interna arbetsrummet).
//
// Admin-nivåer behöver BÅDE en user_roles-rad (för att passera guarden) OCH
// Appwrite-labeln "admin" (för att faktiskt kunna skriva). Intranät får labeln
// "member" och en intranet_members-rad.
//
// Idempotent — går att köra om. Städa bort med:  node scripts/appwrite-test-accounts.mjs --remove
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Users, Query, ID } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)
const users = new Users(client)

const PASSWORD = 'RoglesTest2026!'
const ACCOUNTS = [
  { email: 'skribent.test@example.com', name: 'Test Skribent', kind: 'admin', role: 'skribent' },
  { email: 'redaktor.test@example.com', name: 'Test Redaktör', kind: 'admin', role: 'redaktor' },
  { email: 'intranet.test@example.com', name: 'Test Intranät', kind: 'member' },
]

const remove = process.argv.includes('--remove')

async function findUser(email) {
  const res = await users.list({ queries: [Query.equal('email', [email])] })
  return res.users[0] ?? null
}

async function ensureRow(collectionId, field, userId, data) {
  const res = await databases.listDocuments({ databaseId: DB, collectionId, queries: [Query.equal(field, [userId])] })
  if (res.documents[0]) return
  await databases.createDocument({ databaseId: DB, collectionId, documentId: ID.unique(), data })
}

async function deleteRows(collectionId, field, userId) {
  const res = await databases.listDocuments({ databaseId: DB, collectionId, queries: [Query.equal(field, [userId])] })
  for (const d of res.documents) await databases.deleteDocument({ databaseId: DB, collectionId, documentId: d.$id })
}

for (const a of ACCOUNTS) {
  let u = await findUser(a.email)

  if (remove) {
    if (!u) { console.log(`• ${a.email} finns inte`); continue }
    await deleteRows('user_roles', 'user_id', u.$id)
    await deleteRows('intranet_members', 'user_id', u.$id)
    try { await databases.deleteDocument({ databaseId: DB, collectionId: 'profiles', documentId: u.$id }) } catch { /* saknas */ }
    await users.delete({ userId: u.$id })
    console.log(`✓ borttaget: ${a.email}`)
    continue
  }

  if (!u) {
    u = await users.create({ userId: ID.unique(), email: a.email, password: PASSWORD, name: a.name })
    console.log(`✓ skapade ${a.email}`)
  } else {
    // Se till att lösenordet är det kända, ifall kontot fanns sedan tidigare.
    await users.updatePassword({ userId: u.$id, password: PASSWORD })
    console.log(`• ${a.email} fanns — lösenord återställt`)
  }

  // Profil (namn).
  try {
    await databases.createDocument({ databaseId: DB, collectionId: 'profiles', documentId: u.$id, data: { display_name: a.name } })
  } catch (e) {
    if (e?.code === 409) await databases.updateDocument({ databaseId: DB, collectionId: 'profiles', documentId: u.$id, data: { display_name: a.name } })
    else throw e
  }

  if (a.kind === 'admin') {
    await users.updateLabels({ userId: u.$id, labels: ['admin'] })
    await ensureRow('user_roles', 'user_id', u.$id, { user_id: u.$id, role: a.role })
    console.log(`    → roll ${a.role} + label admin`)
  } else {
    await users.updateLabels({ userId: u.$id, labels: ['member'] })
    await ensureRow('intranet_members', 'user_id', u.$id, { user_id: u.$id, display_name: a.name, added_by: 'testskript' })
    console.log('    → label member + intranet_members')
  }
}

if (!remove) {
  console.log('\n─────────────────────────────────────────────')
  console.log('Testkonton klara. Lösenord för alla:  ' + PASSWORD)
  console.log('Logga in på /admin/login\n')
  console.log('  skribent.test@example.com  → adminpanelen (Skribent)')
  console.log('  redaktor.test@example.com  → adminpanelen (Redaktör)')
  console.log('  intranet.test@example.com  → intranätet /internt')
  console.log('─────────────────────────────────────────────')
}
console.log('\n✅ Klart.')
