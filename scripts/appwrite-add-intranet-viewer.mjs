// Lägger till en LÄSBEHÖRIGHET för intranätet: labeln "viewer" som får läsa
// allt intranätsinnehåll men inte skapa/ändra/ta bort. Säkerhetsgränsen är
// Appwrite-labeln (sätts server-side i api/set-access.js) — read_only-fältet på
// intranet_members används bara för att dölja skriv-UI.
//
// Kör lokalt:  node scripts/appwrite-add-intranet-viewer.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases } from 'node-appwrite'

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
const sleep = ms => new Promise(r => setTimeout(r, ms))

const rw = r => [`read("${r}")`, `create("${r}")`, `update("${r}")`, `delete("${r}")`]
// Innehåll: admin + member skriver, viewer läser.
const INTRANET = [...rw('label:admin'), ...rw('label:member'), 'read("label:viewer")']
// Medlemsregistret: alla intranätsroller läser, bara admin ändrar.
const MEMBERS = [
  'read("label:admin")', 'read("label:member")', 'read("label:viewer")',
  'create("label:admin")', 'update("label:admin")', 'delete("label:admin")',
]

// Kollektionens namn måste skickas med vid updateCollection.
const COLLECTIONS = [
  { id: 'intranet_members', name: 'Intranet Members', perms: MEMBERS },
  { id: 'intranet_notes', name: 'Intranet Notes', perms: INTRANET },
  { id: 'intranet_tasks', name: 'Intranet Tasks', perms: INTRANET },
  { id: 'intranet_notices', name: 'Intranet Notices', perms: INTRANET },
  { id: 'internal_documents', name: 'Internal Documents', perms: INTRANET },
  { id: 'internal_doc_categories', name: 'Internal Doc Categories', perms: INTRANET },
]

// read_only-flagga på medlemsraden (styr bara UI, inte säkerhet).
try {
  await databases.createBooleanAttribute({ databaseId: DB, collectionId: 'intranet_members', key: 'read_only', required: false, default: false })
  console.log('  ✓ intranet_members.read_only')
} catch (e) { if (e?.code === 409) console.log('  • intranet_members.read_only (finns)'); else throw e }
for (let i = 0; i < 30; i++) {
  const a = await databases.listAttributes({ databaseId: DB, collectionId: 'intranet_members' })
  if (a.attributes.find(x => x.key === 'read_only')?.status === 'available') break
  await sleep(1000)
}

for (const c of COLLECTIONS) {
  try {
    await databases.updateCollection({ databaseId: DB, collectionId: c.id, name: c.name, permissions: c.perms, documentSecurity: false })
    console.log(`  ✓ ${c.id} → viewer får läsa`)
  } catch (e) {
    if (e?.code === 404) console.log(`  • ${c.id} finns inte`)
    else throw e
  }
}
console.log('Klart.')
