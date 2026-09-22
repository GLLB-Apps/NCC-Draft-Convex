// Lägger till "none" (kampanjläget "Ingenting") i campaign_mode-enumet på
// site_settings. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-campaign-none.mjs
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
const MODES = ['petition', 'donate', 'consult', 'none']

await databases.updateEnumAttribute({
  databaseId: DB, collectionId: COL, key: 'campaign_mode',
  elements: MODES, required: false, xdefault: 'petition',
})
console.log('✓ campaign_mode utökat med "none"')
