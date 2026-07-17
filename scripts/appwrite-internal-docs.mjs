// Creates the collections for the internal document bank ("Interna dokument").
// These are admin-only for read AND write, so they never surface publicly.
// Files themselves reuse the existing media bucket (see appwrite-doc-uploads).
// Idempotent — safe to re-run.
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
const PERMS = [`read("${ADMIN}")`, `create("${ADMIN}")`, `update("${ADMIN}")`, `delete("${ADMIN}")`]
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function ignoreExists(promise, label) {
  try { await promise; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(exists)'); else throw e }
}

const schema = [
  {
    id: 'internal_doc_categories', name: 'Internal Doc Categories',
    attrs: [
      { fn: 'createStringAttribute', args: { key: 'name', size: 255, required: true } },
      { fn: 'createIntegerAttribute', args: { key: 'sort_order', required: false, default: 0 } },
    ],
  },
  {
    id: 'internal_documents', name: 'Internal Documents',
    attrs: [
      { fn: 'createStringAttribute', args: { key: 'title', size: 255, required: true } },
      { fn: 'createStringAttribute', args: { key: 'description', size: 5000, required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'file_url', size: 2000, required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'file_name', size: 512, required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'file_type', size: 32, required: false, default: null } },
      { fn: 'createIntegerAttribute', args: { key: 'file_size', required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'category_id', size: 64, required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'owner', size: 255, required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'uploaded_by', size: 255, required: false, default: null } },
      { fn: 'createStringAttribute', args: { key: 'uploaded_by_id', size: 64, required: false, default: null } },
    ],
  },
]

for (const col of schema) {
  console.log(`\nCollection: ${col.id}`)
  await ignoreExists(
    databases.createCollection({ databaseId: DB, collectionId: col.id, name: col.name, permissions: PERMS, documentSecurity: false }),
    `collection ${col.id}`,
  )
  for (const a of col.attrs) {
    await ignoreExists(databases[a.fn]({ databaseId: DB, collectionId: col.id, ...a.args }), `attr ${a.args.key}`)
  }
}

// wait for all attributes to be available
for (const col of schema) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await databases.listAttributes({ databaseId: DB, collectionId: col.id })
    const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
    if (col.attrs.every(a => byKey[a.args.key] === 'available')) break
    await sleep(1000)
  }
}
console.log('\n✓ internal document bank ready (admin-only read/write).')
console.log('Done.')
