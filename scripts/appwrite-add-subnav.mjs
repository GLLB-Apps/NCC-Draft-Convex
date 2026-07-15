// Adds a `parent_id` attribute to navigation_items (for sub-navigation) and
// restructures the seeded menu into two dropdown groups as a starting point.
// Idempotent: safe to re-run.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, ID } from 'node-appwrite'

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
const DB = process.env.VITE_APPWRITE_DATABASE_ID
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// 1. add parent_id attribute
try {
  await databases.createStringAttribute({ databaseId: DB, collectionId: 'navigation_items', key: 'parent_id', size: 64, required: false, default: null })
  console.log('✓ attribute parent_id created')
} catch (e) {
  if (e?.code === 409) console.log('• attribute parent_id exists')
  else throw e
}
// wait until available
for (let i = 0; i < 30; i++) {
  const a = await databases.listAttributes({ databaseId: DB, collectionId: 'navigation_items' })
  if (a.attributes.find(x => x.key === 'parent_id')?.status === 'available') break
  await sleep(1000)
}

// 2. restructure into groups (only if not already done)
const all = (await databases.listDocuments({ databaseId: DB, collectionId: 'navigation_items' })).documents
const byLabel = Object.fromEntries(all.map(d => [d.label, d]))

if (byLabel['Material'] || byLabel['Delta']) {
  console.log('• groups already exist — skipping restructure')
} else {
  const update = (id, data) => databases.updateDocument({ databaseId: DB, collectionId: 'navigation_items', documentId: id, data })
  const create = (data) => databases.createDocument({ databaseId: DB, collectionId: 'navigation_items', documentId: ID.unique(), data })

  // top-level order
  const topOrder = ['Bakgrund', 'Ämnen', 'Nyheter', 'Karta']
  for (let i = 0; i < topOrder.length; i++) {
    const d = byLabel[topOrder[i]]
    if (d) await update(d.$id, { sort_order: i, parent_id: null })
  }

  // group: Material
  const material = await create({ label: 'Material', url: '', sort_order: 4, is_active: true, parent_id: null })
  const materialChildren = ['Dokument', 'Tidslinje', 'Media']
  for (let i = 0; i < materialChildren.length; i++) {
    const d = byLabel[materialChildren[i]]
    if (d) await update(d.$id, { parent_id: material.$id, sort_order: 5 + i })
  }

  // group: Delta
  const delta = await create({ label: 'Delta', url: '', sort_order: 8, is_active: true, parent_id: null })
  const deltaChildren = ['Vittnesmål', 'Frågor & svar', 'Kontakt']
  for (let i = 0; i < deltaChildren.length; i++) {
    const d = byLabel[deltaChildren[i]]
    if (d) await update(d.$id, { parent_id: delta.$id, sort_order: 9 + i })
  }
  console.log('✓ menu restructured into groups: Material (Dokument/Tidslinje/Media), Delta (Vittnesmål/Frågor & svar/Kontakt)')
}
console.log('Done.')
