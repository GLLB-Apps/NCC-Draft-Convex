// Lägger till "notifications_seen_at" på profiles — tidsstämpeln för när
// användaren senast läste sina notiser. Allt som kommit in efter den räknas som
// nytt och visas som badge.
// Kör lokalt:  node scripts/appwrite-add-notifications.mjs
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

// notifications_seen  — JSON: { messages, testimonies, drafts } → tidsstämpel per
//                       källa, så att en enskild meny kan markeras läst för sig.
// notifications_cleared_at — när användaren senast rensade lästa notiser.
//
// notifications_seen_at (singular) skapades av en tidigare version och används
// inte längre. Den lämnas kvar tom; går att ta bort i Appwrite-konsolen.
const ATTRS = [
  { key: 'notifications_seen', size: 2000 },
  { key: 'notifications_cleared_at', size: 64 },
]

for (const { key, size } of ATTRS) {
  try {
    await databases.createStringAttribute({
      databaseId: DB, collectionId: 'profiles', key, size, required: false, default: null,
    })
    console.log(`  ✓ profiles.${key}`)
  } catch (e) {
    if (e?.code === 409) console.log(`  • profiles.${key} finns redan`)
    else throw e
  }
}

console.log('\n✅ Klart.')
