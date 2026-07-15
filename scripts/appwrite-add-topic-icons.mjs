// Adds an `icon` attribute to the topics collection and seeds the existing
// topics with icons matching their previous slug-based look. Idempotent.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Query } from 'node-appwrite'

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

try {
  await databases.createStringAttribute({ databaseId: DB, collectionId: 'topics', key: 'icon', size: 32, required: false, default: null })
  console.log('✓ attribute icon created')
} catch (e) {
  if (e?.code === 409) console.log('• attribute icon exists')
  else throw e
}
for (let i = 0; i < 30; i++) {
  const a = await databases.listAttributes({ databaseId: DB, collectionId: 'topics' })
  if (a.attributes.find(x => x.key === 'icon')?.status === 'available') break
  await sleep(1000)
}

const map = {
  'buller-och-vibrationer': 'sound',
  'grundvatten-och-dricksvatten': 'water',
  'naturvarden-och-biologisk-mangfald': 'leaf',
  'trafik-och-transporter': 'truck',
  'damm-och-luftkvalitet': 'wind',
  'friluftsliv-och-rekreation': 'mountain',
}
for (const [slug, icon] of Object.entries(map)) {
  const res = await databases.listDocuments({ databaseId: DB, collectionId: 'topics', queries: [Query.equal('slug', [slug])] })
  for (const doc of res.documents) {
    if (doc.icon) continue
    await databases.updateDocument({ databaseId: DB, collectionId: 'topics', documentId: doc.$id, data: { icon } })
    console.log(`✓ ${slug} -> ${icon}`)
  }
}
console.log('Done.')
