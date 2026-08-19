// Lägger till samrådsläget ("Mejla samrådet") på site_settings: nya fält plus
// 'consult' i campaign_mode-enumet. Idempotent.
// Kör lokalt:  node scripts/appwrite-add-consult.mjs
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
const MODES = ['petition', 'donate', 'consult']

// Enumet finns redan (skapades med donate-läget) – då räcker det att bredda det.
try {
  await databases.createEnumAttribute({
    databaseId: DB, collectionId: COL, key: 'campaign_mode',
    elements: MODES, required: false, xdefault: 'petition',
  })
  console.log('  ✓ campaign_mode skapat med tre lägen')
} catch (e) {
  if (e?.code !== 409) throw e
  await databases.updateEnumAttribute({
    databaseId: DB, collectionId: COL, key: 'campaign_mode',
    elements: MODES, required: false, xdefault: 'petition',
  })
  console.log('  ✓ campaign_mode utökat med "consult"')
}

// Korta strängattribut blir VARCHAR och äter av tabellens radstorlek, som
// site_settings redan slagit i taket på. Stora storlekar lagras som TEXT och
// kostar nästan ingenting i raden – samma knep som övriga långa fält (txt())
// i appwrite-setup.mjs. Längden begränsas i admin-formuläret i stället.
const TEXT = 100000
const make = [
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'consult_url', size: TEXT, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'consult_title', size: TEXT, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'consult_text', size: TEXT, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'consult_button', size: TEXT, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'consult_subject', size: TEXT, required: false }),
]

for (const fn of make) {
  try { await fn(); console.log('  ✓ attribut skapat') }
  catch (e) { if (e?.code === 409) console.log('  • attribut finns redan'); else throw e }
}

console.log('\n✅ Klart.')
