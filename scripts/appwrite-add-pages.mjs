// Creates a `pages` collection holding editable static texts (title + intro)
// per public page, and seeds one document per page with current defaults.
// Idempotent.
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const CONTENT = ['read("any")', 'create("label:admin")', 'update("label:admin")', 'delete("label:admin")']

const PAGES = [
  ['nyheter', 'Nyheter', 'Senaste information och uppdateringar om planerna.'],
  ['amnen', 'Ämnesområden', 'Olika aspekter av den planerade bergtäkten, från naturvärden till buller och trafik.'],
  ['dokument', 'Dokumentarkiv', 'Handlingar, brev, kartor och underlag kopplade till planerna.'],
  ['media', 'Media', 'Bilder, videor, kartor och grafik från området.'],
  ['karta', 'Karta', 'Det planerade området och intressanta punkter.'],
  ['tidslinje', 'Tidslinje', 'Viktiga händelser i processen kring den planerade bergtäkten.'],
  ['vittnesmal', 'Vittnesmål', 'Berättelser och upplevelser från boende och besökare i Rögleskogen.'],
  ['fragor-och-svar', 'Frågor och svar', 'Vanliga frågor om den planerade bergtäkten och detta initiativ.'],
  ['kontakt', 'Kontakt', 'Kontakta initiativet för frågor, information eller samarbete.'],
  ['press', 'Press', 'Information och material för journalister och media.'],
]

async function ignoreExists(p, label) {
  try { await p; console.log('  ✓', label) }
  catch (e) { if (e?.code === 409) console.log('  •', label, '(exists)'); else throw e }
}

await ignoreExists(
  databases.createCollection({ databaseId: DB, collectionId: 'pages', name: 'Pages', permissions: CONTENT, documentSecurity: false }),
  'collection pages',
)
await ignoreExists(databases.createStringAttribute({ databaseId: DB, collectionId: 'pages', key: 'slug', size: 64, required: false }), 'attr slug')
await ignoreExists(databases.createStringAttribute({ databaseId: DB, collectionId: 'pages', key: 'title', size: 255, required: false }), 'attr title')
await ignoreExists(databases.createStringAttribute({ databaseId: DB, collectionId: 'pages', key: 'intro', size: 2000, required: false }), 'attr intro')

for (let i = 0; i < 30; i++) {
  const a = await databases.listAttributes({ databaseId: DB, collectionId: 'pages' })
  if (['slug', 'title', 'intro'].every(k => a.attributes.find(x => x.key === k)?.status === 'available')) break
  await sleep(1000)
}
await ignoreExists(databases.createIndex({ databaseId: DB, collectionId: 'pages', key: 'idx_slug', type: 'key', attributes: ['slug'] }), 'index slug')

for (const [slug, title, intro] of PAGES) {
  await ignoreExists(
    databases.createDocument({ databaseId: DB, collectionId: 'pages', documentId: slug, data: { slug, title, intro } }),
    `page ${slug}`,
  )
}
console.log('Done.')
