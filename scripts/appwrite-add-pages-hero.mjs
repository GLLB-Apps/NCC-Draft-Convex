// Adds the `hero_buttons` attribute to site_settings and creates the
// `custom_pages` collection (admin-created pages rendered with the block
// editor). Idempotent — safe to run repeatedly.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// content collections: public read, admin (label) write
const CONTENT = ['read("any")', 'create("label:admin")', 'update("label:admin")', 'delete("label:admin")']

async function ignore(promise, label) {
  try { await promise; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(exists)'); else throw e }
}
async function waitAvailable(colId, keys) {
  for (let i = 0; i < 30; i++) {
    const res = await databases.listAttributes({ databaseId: DB, collectionId: colId })
    const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
    if (keys.every(k => byKey[k] === 'available')) return
    await sleep(1000)
  }
}

// 1. hero_buttons on site_settings (JSON array of {label,url,style,cta}).
// size 100000 → stored as TEXT so it doesn't count toward the row-byte budget.
await ignore(
  databases.createStringAttribute({ databaseId: DB, collectionId: 'site_settings', key: 'hero_buttons', size: 100000, required: false, default: null }),
  'site_settings.hero_buttons',
)
await waitAvailable('site_settings', ['hero_buttons'])

// 2. custom_pages collection
await ignore(
  databases.createCollection({ databaseId: DB, collectionId: 'custom_pages', name: 'Custom Pages', permissions: CONTENT, documentSecurity: false }),
  'collection custom_pages',
)
const attrs = [
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'slug', size: 255, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'title', size: 255, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'intro', size: 100000, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'blocks', size: 100000, required: false, default: null }),
  () => databases.createEnumAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'status', elements: ['draft', 'published', 'archived'], required: false, default: 'draft' }),
  () => databases.createIntegerAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'sort_order', required: false, default: 0 }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'created_by', size: 64, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'updated_by', size: 64, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'custom_pages', key: 'published_at', size: 64, required: false, default: null }),
]
for (const make of attrs) await ignore(make(), 'attr')
await waitAvailable('custom_pages', ['slug', 'title', 'intro', 'blocks', 'status', 'sort_order'])
for (const key of ['slug', 'status']) {
  await ignore(
    databases.createIndex({ databaseId: DB, collectionId: 'custom_pages', key: `idx_${key}`, type: 'key', attributes: [key] }),
    `index ${key}`,
  )
}
console.log('Done.')
