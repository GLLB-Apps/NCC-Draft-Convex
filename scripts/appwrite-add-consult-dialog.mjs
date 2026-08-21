// Gör texterna i mellanlandningsrutan (den som förklarar att mejlet skrivs och
// skickas i besökarens eget mejlprogram) redigerbara i webbplatsinställningar.
// Tomma fält = de inbyggda standardtexterna. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-consult-dialog.mjs
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
// TEXT-storlek: site_settings radstorlek är redan trång, se appwrite-add-consult.mjs.
const TEXT = 100000
const KEYS = [
  'consult_dialog_title',   // rubriken i rutan
  'consult_dialog_text',    // brödtexten som förklarar vad som händer
  'consult_dialog_note',    // fotnoten om att datorn saknar mejlprogram
  'consult_dialog_confirm', // knappen som går vidare till mejlprogrammet
  'consult_dialog_cancel',  // knappen som stannar kvar
]

for (const key of KEYS) {
  try {
    await databases.createStringAttribute({ databaseId: DB, collectionId: COL, key, size: TEXT, required: false })
    console.log(`  ✓ ${key} skapat`)
  } catch (e) {
    if (e?.code === 409) console.log(`  • ${key} finns redan`)
    else throw e
  }
}

console.log('\n✅ Klart.')
