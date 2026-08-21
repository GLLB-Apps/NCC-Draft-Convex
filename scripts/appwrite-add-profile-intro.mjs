// Lägger till presentationstexten på profiles. Den fylls i när kontot skapas
// och visas för superadmin under Användare, så att den som tilldelar behörighet
// vet vem personen är. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-profile-intro.mjs
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

// Stor storlek = TEXT i stället för VARCHAR, som övriga långa fält. Längden
// begränsas i formuläret i stället.
try {
  await databases.createStringAttribute({ databaseId: DB, collectionId: 'profiles', key: 'intro', size: 100000, required: false })
  console.log('  ✓ profiles.intro skapat')
} catch (e) {
  if (e?.code === 409) console.log('  • profiles.intro finns redan')
  else throw e
}

console.log('\n✅ Klart.')
