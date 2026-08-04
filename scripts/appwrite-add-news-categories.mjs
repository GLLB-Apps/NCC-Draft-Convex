// Adds category, tags and källa/länk to the `posts` collection so nyheter kan
// delas upp i nyheter, pressklipp och krönikor – och så att ett pressklipp kan
// peka på originalartikeln. Idempotent — safe to run repeatedly.
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

async function ignore(promise, label) {
  try { await promise; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(finns redan)'); else throw e }
}
async function waitAvailable(keys) {
  for (let i = 0; i < 30; i++) {
    const res = await databases.listAttributes({ databaseId: DB, collectionId: 'posts' })
    const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
    if (keys.every(k => byKey[k] === 'available')) return
    await sleep(1000)
  }
  console.warn('  ! attributen hann inte bli tillgängliga – kontrollera i Appwrite')
}

const attrs = [
  // Kategori: 'nyhet' | 'pressklipp' | 'kronika' | 'pressmeddelande' (se src/lib/newsCategories.ts).
  ['category', () => databases.createStringAttribute({ databaseId: DB, collectionId: 'posts', key: 'category', size: 32, required: false, default: null })],
  // Taggar som JSON-array, t.ex. ["Rögle kloster","P4"] – driver taggmolnet.
  ['tags', () => databases.createStringAttribute({ databaseId: DB, collectionId: 'posts', key: 'tags', size: 2000, required: false, default: null })],
  // Källans namn, t.ex. "Sveriges Radio P4 Extra".
  ['source', () => databases.createStringAttribute({ databaseId: DB, collectionId: 'posts', key: 'source', size: 255, required: false, default: null })],
  // Länk till originalartikeln/inslaget.
  ['external_url', () => databases.createStringAttribute({ databaseId: DB, collectionId: 'posts', key: 'external_url', size: 2000, required: false, default: null })],
]

for (const [key, make] of attrs) await ignore(make(), `posts.${key}`)
await waitAvailable(attrs.map(([key]) => key))

// Index så att kategorifiltret kan frågas direkt mot databasen senare.
await ignore(
  databases.createIndex({ databaseId: DB, collectionId: 'posts', key: 'idx_category', type: 'key', attributes: ['category'] }),
  'index category',
)

console.log('Klart.')
