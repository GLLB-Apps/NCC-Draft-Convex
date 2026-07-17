// Prepares the testimony image/marketing feature:
//  - lets anonymous visitors upload images to the `media` bucket (create=any)
//  - adds testimonies.consent_marketing (bool)
//  - adds media_items.marketing_ok (bool) — for a future "marketing" media tab
// Idempotent.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Storage } from 'node-appwrite'

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
const storage = new Storage(client)
const DB = process.env.VITE_APPWRITE_DATABASE_ID
const BUCKET = process.env.VITE_APPWRITE_BUCKET_ID || 'media'

// 1. allow anonymous uploads to the media bucket (visitors submitting testimonies)
await storage.updateBucket({
  bucketId: BUCKET,
  name: 'Media',
  permissions: ['read("any")', 'create("any")', 'update("label:admin")', 'delete("label:admin")'],
  fileSecurity: false,
  enabled: true,
  maximumFileSize: 10000000,
  allowedFileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
})
console.log('✓ media bucket: anonymous create enabled (images, max 10MB)')

async function addBool(collectionId, key) {
  try {
    await databases.createBooleanAttribute({ databaseId: DB, collectionId, key, required: false, default: false })
    console.log(`✓ ${collectionId}.${key} created`)
  } catch (e) {
    if (e?.code === 409) console.log(`• ${collectionId}.${key} exists`)
    else throw e
  }
}

await addBool('testimonies', 'consent_marketing')
await addBool('media_items', 'marketing_ok')
console.log('Done.')
