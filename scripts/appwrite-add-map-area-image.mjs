// Adds an optional `image_url` attribute to the map_areas collection, so an
// area (polygon) can show a picture in its popup — same idea as the image
// map_locations already had, and as testimonies. Idempotent — safe to run
// repeatedly.
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
const DB = process.env.VITE_APPWRITE_DATABASE_ID
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const collectionId = 'map_areas'
try {
  await databases.createUrlAttribute({ databaseId: DB, collectionId, key: 'image_url', required: false, default: null })
  console.log(`✓ ${collectionId}: attribute image_url created`)
} catch (e) {
  if (e?.code === 409) console.log(`• ${collectionId}: attribute image_url exists`)
  else throw e
}
for (let i = 0; i < 30; i++) {
  const a = await databases.listAttributes({ databaseId: DB, collectionId })
  if (a.attributes.find(x => x.key === 'image_url')?.status === 'available') break
  await sleep(1000)
}
console.log('Done.')
