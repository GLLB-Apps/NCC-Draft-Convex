// Skapar kollektionen "map_areas" och seedar de tre områdena för Rögleskogen.
// Områdena redigeras därefter i admin (/admin/karta, fliken Polygoner) — den här
// filen är bara startvärden och körs en gång.
// Kör lokalt:  node scripts/appwrite-add-map-areas.mjs
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

// Samma behörigheter som övriga innehållskollektioner: publik läsning, admin skriver.
const PERMS = ['read("any")', 'create("label:admin")', 'update("label:admin")', 'delete("label:admin")']

const ok = m => console.log('  ✓', m)
async function ignoreExists(p, what) {
  try { await p; ok(what) } catch (e) {
    if (e?.code === 409) console.log('  •', what, 'finns redan')
    else throw e
  }
}

// Koordinaterna kommer från Google Maps, [latitud, longitud]. Polygonerna
// stängs automatiskt av Leaflet, därför upprepas inte första punkten sist.
const areas = [
  {
    title: 'Nytt verksamhetsområde',
    description: 'Föreslagen yttre gräns för den utökade verksamheten.',
    color: '#b94a3d', line_style: 'solid', fill_opacity: 0.1, sort_order: 1,
    points: [
      [55.703935, 13.333008], [55.704762, 13.340586], [55.703125, 13.344401],
      [55.696378, 13.349166], [55.696130, 13.347757], [55.695796, 13.347732],
      [55.695776, 13.347267], [55.696844, 13.347296], [55.696787, 13.342120],
      [55.695828, 13.342132], [55.695932, 13.335237], [55.703899, 13.332935],
    ],
  },
  {
    title: 'Nytt brytområde',
    description: 'Den yta inom det nya verksamhetsområdet där berg bryts.',
    color: '#4a6c7f', line_style: 'solid', fill_opacity: 0.15, sort_order: 2,
    points: [
      [55.697975, 13.336910], [55.702850, 13.335633], [55.703453, 13.339479],
      [55.700732, 13.343893], [55.698280, 13.346069],
    ],
  },
  {
    title: 'Nuvarande verksamhetsområde',
    description: 'Nuvarande täkt. Den avslutande sträckan följer väg 952 norrut.',
    color: '#7d2e24', line_style: 'dashed', fill_opacity: 0.07, sort_order: 3,
    points: [
      [55.703019, 13.344672], [55.701944, 13.347779], [55.703208, 13.350641],
      [55.703505, 13.353620], [55.703183, 13.355346], [55.702789, 13.355864],
      [55.702343, 13.355628], [55.701754, 13.357568], [55.701691, 13.358963],
      [55.697724, 13.357872], [55.696141, 13.361710], [55.694577, 13.361412],
      [55.694342, 13.359857], [55.693644, 13.358311], [55.693701, 13.354725],
      [55.693828, 13.354140], [55.694488, 13.350729],
    ],
  },
]

console.log('Kollektion: map_areas')
await ignoreExists(
  databases.createCollection({
    databaseId: DB, collectionId: 'map_areas', name: 'Map Areas',
    permissions: PERMS, documentSecurity: false,
  }),
  'collection map_areas',
)

const attrs = [
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'title', size: 255, required: true }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'description', size: 100000, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'color', size: 16, required: false, default: '#b94a3d' }),
  () => databases.createEnumAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'line_style', elements: ['solid', 'dashed'], required: false, default: 'solid' }),
  () => databases.createFloatAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'fill_opacity', required: false, default: 0.1 }),
  // Punkterna lagras som JSON-sträng; supabase-shimmen parsar dem åt appen.
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'points', size: 100000, required: false }),
  () => databases.createIntegerAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'sort_order', required: false, default: 0 }),
  () => databases.createEnumAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'status', elements: ['draft', 'published', 'archived'], required: false, default: 'draft' }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'published_at', size: 255, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'created_by', size: 64, required: false }),
  () => databases.createStringAttribute({ databaseId: DB, collectionId: 'map_areas', key: 'updated_by', size: 64, required: false }),
]
for (const make of attrs) await ignoreExists(make(), 'attribut')

// Attributen blir tillgängliga asynkront — vänta tills de är "available".
process.stdout.write('  … väntar på attribut')
for (let n = 0; n < 30; n++) {
  const list = await databases.listAttributes({ databaseId: DB, collectionId: 'map_areas' })
  if (list.attributes.every(a => a.status === 'available')) break
  process.stdout.write('.')
  await new Promise(r => setTimeout(r, 1000))
}
console.log('')

for (const key of ['status', 'sort_order']) {
  await ignoreExists(
    databases.createIndex({ databaseId: DB, collectionId: 'map_areas', key: `idx_${key}`, type: 'key', attributes: [key] }),
    `index ${key}`,
  )
}

// Seeda bara om kollektionen är tom, så att omkörning inte skapar dubbletter
// eller skriver över gränser som redigerats i admin.
const existing = await databases.listDocuments({ databaseId: DB, collectionId: 'map_areas', queries: [Query.limit(1)] })
if (existing.total > 0) {
  console.log(`\n• Hoppar över seed — ${existing.total} område(n) finns redan.`)
} else {
  console.log('\nSeedar områden')
  for (const a of areas) {
    await databases.createDocument({
      databaseId: DB, collectionId: 'map_areas', documentId: ID.unique(),
      data: { ...a, points: JSON.stringify(a.points), status: 'published', published_at: new Date().toISOString() },
    })
    ok(a.title)
  }
}

console.log('\n✅ Klart.')
