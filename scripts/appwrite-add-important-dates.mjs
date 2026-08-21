// Flera framtida viktiga datum i stället för ett enda. Lagras som en
// JSON-sträng på site_settings ([{ date, label, note }]); startsidan visar
// automatiskt det närmast kommande och går vidare till nästa när dagen passerat.
// Det gamla fältet next_important_date ligger kvar som reserv. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-important-dates.mjs
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

try {
  await databases.createStringAttribute({ databaseId: DB, collectionId: 'site_settings', key: 'important_dates', size: 100000, required: false })
  console.log('  ✓ site_settings.important_dates skapat')
} catch (e) {
  if (e?.code === 409) console.log('  • site_settings.important_dates finns redan')
  else throw e
}

console.log('\n✅ Klart.')
