// Creates the `sponsors` collection: a list of sponsor logos shown as a ticker
// on the start page. Public read, admin write. Idempotent.
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

const ADMIN = 'label:admin'
const PERMS = [`read("any")`, `create("${ADMIN}")`, `update("${ADMIN}")`, `delete("${ADMIN}")`]
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ignoreExists(p, label) {
  try { await p; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(exists)'); else throw e }
}

const COL = 'sponsors'
await ignoreExists(
  databases.createCollection({ databaseId: DB, collectionId: COL, name: 'Sponsors', permissions: PERMS, documentSecurity: false }),
  `collection ${COL}`,
)
const attrs = [
  ['createStringAttribute', { key: 'name', size: 255, required: true }],
  ['createStringAttribute', { key: 'image_url', size: 2000, required: false, default: null }],
  ['createStringAttribute', { key: 'link_url', size: 2000, required: false, default: null }],
  ['createIntegerAttribute', { key: 'sort_order', required: false, default: 0 }],
  ['createBooleanAttribute', { key: 'is_active', required: false, default: true }],
]
for (const [fn, args] of attrs) {
  await ignoreExists(databases[fn]({ databaseId: DB, collectionId: COL, ...args }), `attr ${args.key}`)
}
for (let i = 0; i < 30; i++) {
  const res = await databases.listAttributes({ databaseId: DB, collectionId: COL })
  const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
  if (attrs.every(([, a]) => byKey[a.key] === 'available')) break
  await sleep(1000)
}
console.log('\n✓ sponsors collection ready.')
console.log('Done.')
