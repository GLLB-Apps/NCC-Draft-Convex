// Seeds the /bakgrund page content as editable blocks (site_settings.background_blocks),
// converting the previously hard-coded sections, bullet lists and CTA into blocks.
// Only runs if background_blocks is currently empty — never overwrites edits.
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
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)

const blocks = [
  { type: 'heading', text: 'Om Rögleskogen' },
  { type: 'paragraph', text: 'Rögleskogen ligger mellan Södra Sandby och Dalby i Lunds kommun. Området används av boende för promenader, rekreation och naturupplevelser. Skogen hyser enligt uppgifter från boende flera naturvärden och arter.' },
  { type: 'paragraph', text: 'Observera: Informationen på denna webbplats är exempeldata och ska inte tolkas som verifierade fakta utan särskild källhänvisning.' },
  { type: 'heading', text: 'Varför detta initiativ?' },
  { type: 'paragraph', text: 'NCC har informerat om planer på att ansöka om tillstånd för en ny bergtäkt i området. Boende har frågor om hur verksamheten kan påverka natur, miljö, hälsa och livsmiljö. Detta initiativ samlar information, dokument, vittnesmål och frågor på ett ställe.' },
  {
    type: 'list', title: 'Vad vi gör', items: [
      'Samlar och strukturerar offentlig information om planerna',
      'Samlar in vittnesmål och observationer från boende',
      'Sprider information till boende, journalister och beslutsfattare',
      'Sammanställer frågor och farhågor som väcks av planerna',
      'Uppmuntrar till saklig och respektfull dialog',
    ],
  },
  {
    type: 'list', title: 'Viktiga principer', items: [
      'All information ska vara saklig och källhänvisad där det är relevant',
      'Personliga vittnesmål märks tydligt som sådana',
      'Vi gör inga juridiska eller miljövetenskapliga påståenden utan stöd i publicerade källor',
      'Initiativet är oberoende och drivs av boende',
    ],
  },
  {
    type: 'cta', title: 'Läs mer', links: [
      { label: 'Ämnesområden', url: '/amnen' },
      { label: 'Dokument', url: '/dokument' },
      { label: 'Tidslinje', url: '/tidslinje' },
    ],
  },
]

const res = await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings' })
const doc = res.documents[0]
if (!doc) { console.log('No site_settings document found.'); process.exit(1) }

let current = []
try { current = JSON.parse(doc.background_blocks || '[]') } catch { current = [] }

if (Array.isArray(current) && current.length > 0) {
  console.log(`• background_blocks already has ${current.length} block(s) — leaving as is.`)
} else {
  await databases.updateDocument({
    databaseId: DB, collectionId: 'site_settings', documentId: doc.$id,
    data: { background_blocks: JSON.stringify(blocks) },
  })
  console.log(`✓ seeded ${blocks.length} background blocks (2 lists + CTA included).`)
}
console.log('Done.')
