// Egen ikonsamling. Ikoner som hämtas in från lucide.dev kan sparas här och
// dyker då upp som gruppen "Egna ikoner" överst i ikonväljaren, i stället för
// att behöva klistras in på nytt varje gång. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-custom-icons.mjs
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
const databases = new Databases(new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY))

const COL = 'custom_icons'
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ignoreExists(p, label) {
  try { await p; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(finns)'); else throw e }
}

// Samma behörighetsmönster som övrigt innehåll: läses av alla, ändras av admin.
await ignoreExists(databases.createCollection({
  databaseId: DB, collectionId: COL, name: 'Custom Icons',
  permissions: ['read("any")', 'create("label:admin")', 'update("label:admin")', 'delete("label:admin")'],
  documentSecurity: false,
}), `collection ${COL}`)

const attrs = [
  { key: 'name', size: 64, required: true },   // Lucide-namn i kebab-case, t.ex. "anchor"
  { key: 'label', size: 100, required: false }, // valfritt eget namn i väljaren
  { key: 'added_by', size: 255, required: false },
]
for (const a of attrs) {
  await ignoreExists(databases.createStringAttribute({ databaseId: DB, collectionId: COL, ...a }), `attr ${a.key}`)
}

// Vänta in attributen innan indexet skapas.
for (let i = 0; i < 30; i++) {
  const res = await databases.listAttributes({ databaseId: DB, collectionId: COL })
  const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
  if (attrs.every(a => byKey[a.key] === 'available')) break
  await sleep(1000)
}
// Unikt: samma ikon ska inte kunna sparas två gånger.
await ignoreExists(databases.createIndex({
  databaseId: DB, collectionId: COL, key: 'idx_name', type: 'unique', attributes: ['name'],
}), `index ${COL}.name`)

console.log('\n✅ Klart.')
