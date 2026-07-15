// Seeds sample content (posts, media, map locations) and the public navigation
// menu into Appwrite. Ports supabase/migrations/02_seed_sample_content.sql and
// adds navigation_items (which had no SQL seed). Idempotent: skips any
// collection that already has documents.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, ID } from 'node-appwrite'

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

async function seed(collectionId, rows) {
  const existing = await databases.listDocuments({ databaseId: DB, collectionId })
  if (existing.total > 0) {
    console.log(`• ${collectionId}: already has ${existing.total} row(s) — skipped`)
    return
  }
  for (const data of rows) {
    await databases.createDocument({ databaseId: DB, collectionId, documentId: ID.unique(), data })
  }
  console.log(`✓ ${collectionId}: seeded ${rows.length} row(s)`)
}

const posts = [
  {
    title: 'NCC lämnar in ansökan om täkttillstånd',
    slug: 'ncc-lamnar-in-ansokan-om-takttillstand',
    excerpt: 'NCC AB har lämnat in en ansökan till länsstyrelsen i Skåne om tillstånd för bergtäkt i Rögleskogen. Initiativet följer processen noggrant.',
    content: '[{"type":"paragraph","text":"NCC AB har lämnat in en formell ansökan till Länsstyrelsen i Skåne om tillstånd för en ny bergtäkt i Rögleskogen, beläget mellan Södra Sandby och Dalby i Lunds kommun."},{"type":"heading","text":"Vad ansökan innehåller"},{"type":"paragraph","text":"Ansökan avser ett område om cirka 70 hektar och inkluderar brytningstillstånd för krosssten samt tillhörande transporter via befintliga vägar."},{"type":"factbox","title":"Nyckeluppgifter","text":"Beräknad brytningstid: 25–30 år. Planerad produktionsvolym: upp till 3 miljoner ton per år. Planerat driftstart: ej fastställt."},{"type":"paragraph","text":"Länsstyrelsen kommer att remittera ansökan till berörda myndigheter och ge allmänheten möjlighet att yttra sig under samrådstiden."}]',
    status: 'published', is_pinned: true, published_at: daysAgo(5), author: 'Initiativet Rädda Rögleskogen',
  },
  {
    title: 'Informationsmöte med Lunds kommun',
    slug: 'informationsmote-med-lunds-kommun',
    excerpt: 'Lunds kommun bjuder in till ett informationsmöte om den planerade bergtäkten. Allmänheten är välkommen att ställa frågor.',
    content: '[{"type":"paragraph","text":"Lunds kommuns miljönämnd anordnar ett informationsmöte för boende och intressenter i området kring Rögleskogen."},{"type":"heading","text":"Praktisk information"},{"type":"paragraph","text":"Mötet hålls i kommunens lokaler. Representanter från planerings- och miljöförvaltningen kommer att presentera ärendet och svara på frågor."},{"type":"warning","title":"Anmälan","text":"Platser är begränsade. Anmäl ditt deltagande i förväg via kommunens hemsida."}]',
    status: 'published', is_pinned: false, published_at: daysAgo(12), author: 'Lunds kommun',
  },
  {
    title: 'Ny rapport om naturvärden i Rögleskogen',
    slug: 'ny-rapport-om-naturvarden-i-rogleskogen',
    excerpt: 'En oberoende naturvärdesinventering visar på höga biologiska värden i det planerade täktområdet.',
    content: '[{"type":"paragraph","text":"En naturvärdesinventering genomförd av en oberoende konsult har nu slutförts. Rapporten identifierar flera nyckelbiotoper och artrika miljöer inom det planerade täktområdet."},{"type":"heading","text":"Viktiga fynd"},{"type":"paragraph","text":"Inventeringen identifierade bland annat förekomster av rödlistade arter och värdefulla skogsstrukturer som stående döda träd och äldre hålträd."},{"type":"sources","sources":[{"label":"Naturvårdsverkets rödlista 2024","url":"https://www.naturvardsverket.se"},{"label":"Artdatabankens artfakta","url":"https://artfakta.se"}]}]',
    status: 'published', is_pinned: false, published_at: daysAgo(20), author: 'Initiativet Rädda Rögleskogen',
  },
]

const media = [
  { title: 'Rögleskogen — utsikt mot söder', description: 'Vy över skogen mot Dalby i bakgrunden.', alt_text: 'Tät lövskog med solsken som bryts genom lövverket', media_type: 'image', file_url: 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg', photographer: 'Pexels', media_date: '2024-05-15', location: 'Rögleskogen, Lunds kommun', is_press_allowed: true, status: 'published', published_at: daysAgo(30) },
  { title: 'Lövblandad skog — detalj', description: 'Närbild på ek och hassel i skogskanten.', alt_text: 'Närbild på gröna löv och trädstammar i lövskog', media_type: 'image', file_url: 'https://images.pexels.com/photos/167698/pexels-photo-167698.jpeg', photographer: 'Pexels', media_date: '2024-05-15', location: 'Rögleskogen', is_press_allowed: true, status: 'published', published_at: daysAgo(30) },
  { title: 'Promenadstråk i skogen', description: 'Befintligt promenadstråk som löper genom det planerade täktområdet.', alt_text: 'Skogsväg omgiven av träd på båda sidor', media_type: 'image', file_url: 'https://images.pexels.com/photos/38537/woodland-road-falling-leaf-natural-38537.jpeg', photographer: 'Pexels', media_date: '2024-05-15', location: 'Rögleskogen', is_press_allowed: true, status: 'published', published_at: daysAgo(29) },
  { title: 'Flygfoto över området', description: 'Översiktsbild som visar skogsområdet och intilliggande bebyggelse.', alt_text: 'Flygfoto över grön skog med åkrar runt om', media_type: 'image', file_url: 'https://images.pexels.com/photos/1459534/pexels-photo-1459534.jpeg', photographer: 'Pexels', media_date: '2024-04-10', location: 'Södra Sandby – Dalby', is_press_allowed: true, status: 'published', published_at: daysAgo(28) },
  { title: 'Planerade täktgränser — kartskiss', description: 'Skiss över de planerade täktgränserna baserad på NCCs ansökan.', alt_text: 'Karta med markerat planerat täktområde', media_type: 'map', photographer: 'Initiativet Rädda Rögleskogen', media_date: '2024-06-01', is_press_allowed: false, status: 'published', published_at: daysAgo(10) },
]

const mapLocations = [
  { title: 'Planerat täktcentrum', description: 'Det ungefärliga centrum för det planerade täktområdet enligt NCCs ansökan.', lat: 55.7285, lng: 13.3210, point_type: 'quarry_area', status: 'published', published_at: daysAgo(15) },
  { title: 'Södra Sandby ortsgräns', description: 'Gränsen för Södra Sandby tätort. Planerat täktområde börjar ca 400 m härifrån.', lat: 55.7150, lng: 13.3050, point_type: 'residence_distance', status: 'published', published_at: daysAgo(15) },
  { title: 'Promenadstråk — norra delen', description: 'Populärt promenadstråk som löper genom norra delen av det planerade täktområdet.', lat: 55.7350, lng: 13.3180, point_type: 'walking_trail', status: 'published', published_at: daysAgo(15) },
  { title: 'Observationspunkt — skogskanten', description: 'Punkt med god utsikt över skogen och det planerade täktområdet.', lat: 55.7300, lng: 13.3250, point_type: 'observation_point', status: 'published', published_at: daysAgo(14) },
  { title: 'Planerad transportväg', description: 'NCCs planerade transportväg för uttransport av krossad sten.', lat: 55.7200, lng: 13.3150, point_type: 'transport_route', status: 'published', published_at: daysAgo(14) },
  { title: 'Identifierat naturvärde — hålträd', description: 'Område med äldre hålträd klassade som nyckelbiotop i inventeringen.', lat: 55.7320, lng: 13.3190, point_type: 'nature_value', status: 'published', published_at: daysAgo(10) },
]

const navigation = [
  ['Bakgrund', '/bakgrund'],
  ['Ämnen', '/amnen'],
  ['Nyheter', '/nyheter'],
  ['Karta', '/karta'],
  ['Tidslinje', '/tidslinje'],
  ['Dokument', '/dokument'],
  ['Media', '/media'],
  ['Vittnesmål', '/vittnesmal'],
  ['Frågor & svar', '/fragor-och-svar'],
  ['Kontakt', '/kontakt'],
].map(([label, url], idx) => ({ label, url, sort_order: idx, is_active: true }))

async function main() {
  await seed('posts', posts)
  await seed('media_items', media)
  await seed('map_locations', mapLocations)
  await seed('navigation_items', navigation)
  console.log('\n✅ Seed complete.')
}
main().catch(e => { console.error('\n❌', e.message || e); process.exit(1) })
