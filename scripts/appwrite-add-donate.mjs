// Lägger till kampanjläge-fälten på site_settings, så att webbplatsen kan växla
// mellan namninsamling och donationsflöde. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-donate.mjs
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
const make = [
  () => databases.createEnumAttribute({ databaseId: DB, collectionId: COL, key: 'campaign_mode', elements: ['petition', 'donate'], required: false, default: 'petition' }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'donate_url', size: 2000, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'donate_title', size: 255, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'donate_text', size: 1000, required: false, default: null }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'donate_button', size: 100, required: false, default: null }),
]

for (const fn of make) {
  try { await fn(); console.log('  ✓ attribut skapat') }
  catch (e) { if (e?.code === 409) console.log('  • attribut finns redan'); else throw e }
}

console.log('\n✅ Klart.')
