// Flyttar vittnesmålens känsliga fält ur det publika dokumentet.
//
// Bakgrund: ett godkänt vittnesmål är publikt läsbart i sin helhet, och Appwrite
// har ingen behörighet per fält. Alltså låg inskickarens e-post, redaktionens
// interna anteckning — och namnet även på vittnesmål märkta som anonyma — öppet
// för vem som helst som frågade databasen direkt.
//
// Efter körning:
//   • testimonies      = det som faktiskt ska synas publikt
//   • testimony_contacts = e-post, riktigt namn och intern anteckning, admin only
//
// Guests får skapa i den nya kollektionen (formuläret skickas utan inloggning)
// men aldrig läsa den.
//
// Skriptet flyttar befintliga värden och tömmer dem sedan i det publika
// dokumentet. Idempotent: en rad som redan flyttats hoppas över.
//
// Kör lokalt:  node scripts/appwrite-split-testimony-contacts.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Query, ID } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'
const db = new Databases(new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY))

const COL = 'testimony_contacts'
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function ignoreExists(p, label) {
  try { await p; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(finns)'); else throw e }
}

// 1) Kollektionen. create("any") eftersom formuläret skickas utloggat; ingen
//    läsrätt för någon annan än admin.
console.log('Kollektion')
await ignoreExists(db.createCollection({
  databaseId: DB, collectionId: COL, name: 'Testimony Contacts',
  permissions: ['create("any")', 'read("label:admin")', 'update("label:admin")', 'delete("label:admin")'],
  documentSecurity: false,
}), `collection ${COL}`)

const attrs = [
  { key: 'testimony_id', size: 64, required: true },
  { key: 'email', size: 255, required: false },
  // Riktigt namn. Sparas även när vittnesmålet publiceras anonymt — publikt
  // ligger då inget namn alls.
  { key: 'author_name', size: 255, required: false },
  { key: 'internal_note', size: 100000, required: false },
]
for (const a of attrs) {
  await ignoreExists(db.createStringAttribute({ databaseId: DB, collectionId: COL, ...a }), `attr ${a.key}`)
}
for (let i = 0; i < 30; i++) {
  const res = await db.listAttributes({ databaseId: DB, collectionId: COL })
  const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
  if (attrs.every(a => byKey[a.key] === 'available')) break
  await sleep(1000)
}
await ignoreExists(db.createIndex({
  databaseId: DB, collectionId: COL, key: 'idx_testimony_id', type: 'key', attributes: ['testimony_id'],
}), `index ${COL}.testimony_id`)

// 2) Flytta befintliga värden.
console.log('\nFlyttar befintliga vittnesmål')
const befintliga = await db.listDocuments({ databaseId: DB, collectionId: COL, queries: [Query.limit(500)] })
const redanFlyttad = new Set(befintliga.documents.map(d => d.testimony_id))

const vittnesmål = await db.listDocuments({ databaseId: DB, collectionId: 'testimonies', queries: [Query.limit(500)] })
let flyttade = 0
let rensadeNamn = 0

for (const t of vittnesmål.documents) {
  const anonym = t.is_anonymous === true
  const harKänsligt = t.email || t.internal_note || (anonym && t.author_name)

  if (harKänsligt && !redanFlyttad.has(t.$id)) {
    await db.createDocument({
      databaseId: DB, collectionId: COL, documentId: ID.unique(),
      data: {
        testimony_id: t.$id,
        email: t.email || null,
        author_name: t.author_name || null,
        internal_note: t.internal_note || null,
      },
    })
    flyttade++
  }

  // Töm det publika dokumentet. Namnet tas bort bara när vittnesmålet är
  // anonymt — annars ska det ju stå kvar och synas.
  const rensning = {}
  if (t.email) rensning.email = null
  if (t.internal_note) rensning.internal_note = null
  if (anonym && t.author_name) { rensning.author_name = null; rensadeNamn++ }
  if (Object.keys(rensning).length > 0) {
    await db.updateDocument({ databaseId: DB, collectionId: 'testimonies', documentId: t.$id, data: rensning })
    console.log(`  ✓ "${(t.title || t.$id).slice(0, 34)}" – rensade ${Object.keys(rensning).join(', ')}`)
  }
}

console.log(`\n${flyttade} rad(er) flyttade till ${COL}, ${rensadeNamn} anonymt namn dolt.`)
console.log('✅ Klart.')
