// Points the site logo (site_settings.logo_url) at the bundled logo asset.
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

const LOGO_URL = '/site_logo/ncc_rs_logo.svg'
const res = await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings' })
const doc = res.documents[0]
if (!doc) { console.log('No site_settings document found.'); process.exit(1) }

await databases.updateDocument({
  databaseId: DB, collectionId: 'site_settings', documentId: doc.$id,
  data: { logo_url: LOGO_URL },
})
console.log(`✓ site logo set to ${LOGO_URL}`)
console.log('Done.')
