// Lägger till content_width (heltal, 800–1100, standard 800) på
// site_settings — sidobreddens slider i Admin → Inställningar. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-content-width.mjs
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
const databases = new Databases(new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY))

const COL = 'site_settings'

try {
  await databases.createIntegerAttribute({
    databaseId: DB, collectionId: COL, key: 'content_width',
    required: false, min: 800, max: 1100, xdefault: 800,
  })
  console.log('✓ content_width skapat')
} catch (err) {
  if (err.code === 409) console.log('… content_width finns redan')
  else throw err
}
