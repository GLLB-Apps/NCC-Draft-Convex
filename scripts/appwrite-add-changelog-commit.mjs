// Kopplar ändringsloggen till GitHub: varje importerad post minns vilken commit
// den kom från, så att en omkörning av importen inte skapar dubbletter.
//
// Indexet är avsiktligt av typen "key" och inte "unique": manuellt skrivna
// poster saknar commit_sha, och dubblettspärren sitter i importvyn som jämför
// mot de sha:n som redan finns. Ett unikt index hade gjort hela importen till en
// felkälla den dagen Appwrite råkar lagra tomt värde i stället för null.
//
// Idempotent. Kör lokalt:  node scripts/appwrite-add-changelog-commit.mjs
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

const COL = 'changelog_entries'
const sleep = ms => new Promise(r => setTimeout(r, ms))

try {
  await databases.createStringAttribute({ databaseId: DB, collectionId: COL, key: 'commit_sha', size: 64, required: false })
  console.log('  ✓ commit_sha skapat')
} catch (e) {
  if (e?.code === 409) console.log('  • commit_sha finns redan')
  else throw e
}

// Vänta in attributet innan indexet skapas.
for (let i = 0; i < 30; i++) {
  const res = await databases.listAttributes({ databaseId: DB, collectionId: COL })
  if (res.attributes.some(a => a.key === 'commit_sha' && a.status === 'available')) break
  await sleep(1000)
}

try {
  await databases.createIndex({ databaseId: DB, collectionId: COL, key: 'idx_commit_sha', type: 'key', attributes: ['commit_sha'] })
  console.log('  ✓ index på commit_sha skapat')
} catch (e) {
  if (e?.code === 409) console.log('  • index på commit_sha finns redan')
  else throw e
}

console.log('\n✅ Klart.')
