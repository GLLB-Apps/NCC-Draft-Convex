// Adds two more topics so the topic grid is a full 3x2. Idempotent per slug.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, ID, Query } from 'node-appwrite'

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
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const block = (arr) => JSON.stringify(arr)

const topics = [
  {
    title: 'Damm och luftkvalitet', slug: 'damm-och-luftkvalitet',
    intro: 'Hur påverkas luften av damm från borrning, krossning och transporter?',
    content: block([
      { type: 'paragraph', text: 'Borrning, sprängning, krossning och transporter av sten kan ge upphov till damm som sprids i omgivningen, särskilt vid torrt och blåsigt väder.' },
      { type: 'heading', text: 'Vad dammet innehåller' },
      { type: 'paragraph', text: 'Stendamm kan innehålla fina partiklar, bland annat kvarts, som vid höga halter kan påverka hälsan hos närboende och känsliga grupper.' },
      { type: 'factbox', title: 'Skyddsåtgärder att bevaka', text: 'Vattenbegjutning av krossverk och vägar, dammbindning, mätprogram för partiklar och krav på hastighetsbegränsningar för transporter.' },
    ]),
    status: 'published', sort_order: 4, published_at: daysAgo(7),
  },
  {
    title: 'Friluftsliv och rekreation', slug: 'friluftsliv-och-rekreation',
    intro: 'Vad betyder skogen för promenader, motion och rekreation – och vad står på spel?',
    content: block([
      { type: 'paragraph', text: 'Rögleskogen används av många för promenader, löpning, svamp- och bärplockning samt naturupplevelser. Området är en viktig del av närmiljöns rekreationsvärde.' },
      { type: 'heading', text: 'Stråk och målpunkter' },
      { type: 'paragraph', text: 'Befintliga promenadstråk löper genom det planerade täktområdet. En täkt skulle innebära begränsad tillgänglighet och förändrad landskapsbild under lång tid.' },
      { type: 'warning', title: 'Långsiktig påverkan', text: 'Brytningstiden anges till 25–30 år, vilket innebär att rekreationsmöjligheterna i området påverkas under en hel generation.' },
    ]),
    status: 'published', sort_order: 5, published_at: daysAgo(6),
  },
]

async function main() {
  for (const t of topics) {
    const existing = await databases.listDocuments({ databaseId: DB, collectionId: 'topics', queries: [Query.equal('slug', [t.slug])] })
    if (existing.total > 0) { console.log(`• topic "${t.slug}" exists — skipped`); continue }
    await databases.createDocument({ databaseId: DB, collectionId: 'topics', documentId: ID.unique(), data: t })
    console.log(`✓ topic "${t.slug}" created`)
  }
  const all = await databases.listDocuments({ databaseId: DB, collectionId: 'topics' })
  console.log(`\nTotal topics now: ${all.total}`)
}
main().catch(e => { console.error('\n❌', e.message || e); process.exit(1) })
