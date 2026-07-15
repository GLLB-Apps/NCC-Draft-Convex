// Sets the hero background image path on the site_settings row.
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

const HERO = process.argv[2] || '/hero-rogleskogen.jpg'

const res = await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings' })
if (res.total === 0) { console.error('❌ no site_settings row found'); process.exit(1) }
await databases.updateDocument({
  databaseId: DB, collectionId: 'site_settings', documentId: res.documents[0].$id,
  data: { hero_image: HERO },
})
console.log(`✓ hero_image set to "${HERO}"`)
