// Ändringslogg över systemet: en datumsorterad lista i adminpanelen där
// redaktionen skriver upp vad som byggts, ändrats och rättats. Bara konton med
// admin-labeln kommer åt den — den är ett internt arbetsverktyg, inte publik.
// Idempotent.
// Kör lokalt:  node scripts/appwrite-add-changelog.mjs
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

const COL = 'changelog_entries'
const ADMIN = 'label:admin'
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ignoreExists(p, label) {
  try { await p; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(finns)'); else throw e }
}

await ignoreExists(databases.createCollection({
  databaseId: DB, collectionId: COL, name: 'Changelog Entries',
  permissions: [`read("${ADMIN}")`, `create("${ADMIN}")`, `update("${ADMIN}")`, `delete("${ADMIN}")`],
  documentSecurity: false,
}), `collection ${COL}`)

const S = (key, size, required = false) => ({ fn: 'createStringAttribute', args: { key, size, required } })
const attrs = [
  S('title', 255, true),
  S('body', 100000),        // fritext/markdown
  S('entry_date', 32),      // YYYY-MM-DD — datumet posten sorteras på
  S('version', 32),         // valfri versionsetikett, t.ex. "1.4"
  S('created_by', 64),
  S('created_by_name', 255),
]
for (const a of attrs) {
  await ignoreExists(databases[a.fn]({ databaseId: DB, collectionId: COL, ...a.args }), `attr ${a.args.key}`)
}
await ignoreExists(databases.createEnumAttribute({
  databaseId: DB, collectionId: COL, key: 'category',
  elements: ['feature', 'improvement', 'fix', 'other'], required: false, xdefault: 'other',
}), 'attr category')

// Vänta in attributen innan indexen skapas.
const keys = [...attrs.map(a => a.args.key), 'category']
for (let i = 0; i < 30; i++) {
  const res = await databases.listAttributes({ databaseId: DB, collectionId: COL })
  const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
  if (keys.every(k => byKey[k] === 'available')) break
  await sleep(1000)
}
for (const key of ['entry_date', 'category']) {
  await ignoreExists(databases.createIndex({
    databaseId: DB, collectionId: COL, key: `idx_${key}`, type: 'key', attributes: [key],
  }), `index ${COL}.${key}`)
}

console.log('\n✅ Klart.')
