// Seeds the remaining content types: topics, documents, timeline events,
// FAQ (categories + items), contacts and a couple of approved testimonies.
// Idempotent: skips any collection that already has documents.
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
const create = (collectionId, data) =>
  databases.createDocument({ databaseId: DB, collectionId, documentId: ID.unique(), data })

async function isEmpty(collectionId) {
  const r = await databases.listDocuments({ databaseId: DB, collectionId })
  if (r.total > 0) { console.log(`• ${collectionId}: already has ${r.total} row(s) — skipped`); return false }
  return true
}
async function seed(collectionId, rows) {
  if (!(await isEmpty(collectionId))) return
  for (const data of rows) await create(collectionId, data)
  console.log(`✓ ${collectionId}: seeded ${rows.length} row(s)`)
}

// ---- topics ----------------------------------------------------------------
const block = (arr) => JSON.stringify(arr)
const topics = [
  {
    title: 'Buller och vibrationer', slug: 'buller-och-vibrationer',
    intro: 'Hur påverkas närboende av buller från borrning, sprängning och krossning?',
    content: block([
      { type: 'paragraph', text: 'En bergtäkt genererar buller från flera moment: borrning inför sprängning, själva sprängningarna, krossning av sten samt transporter. Ljudnivåerna varierar över dygnet och året.' },
      { type: 'heading', text: 'Riktvärden' },
      { type: 'paragraph', text: 'Naturvårdsverket har riktvärden för industribuller vid bostäder. Vid en tillståndsprövning ska verksamhetsutövaren visa att riktvärdena kan innehållas.' },
      { type: 'factbox', title: 'Vanliga bullerkällor', text: 'Sprängning sker vanligtvis vid fasta tider. Krossverk kan vara igång under större delen av arbetsdagen. Tunga transporter tillkommer på till- och frånfartsvägar.' },
    ]),
    status: 'published', sort_order: 0, published_at: daysAgo(18),
  },
  {
    title: 'Grundvatten och dricksvatten', slug: 'grundvatten-och-dricksvatten',
    intro: 'Vilka risker finns för grundvattnet när man bryter berg under grundvattennivån?',
    content: block([
      { type: 'paragraph', text: 'Brytning under grundvattenytan kräver att vatten leds bort (länshållning), vilket kan sänka grundvattennivån i ett område runt täkten.' },
      { type: 'heading', text: 'Enskilda brunnar' },
      { type: 'paragraph', text: 'Fastigheter med egen brunn kan påverkas om grundvattennivån sänks. Påverkans omfattning beror på berggrund, avstånd och brytningsdjup.' },
      { type: 'warning', title: 'Att bevaka', text: 'Kontrollprogram för grundvatten och åtaganden om ersättningsvatten är viktiga punkter att granska i en ansökan.' },
    ]),
    status: 'published', sort_order: 1, published_at: daysAgo(17),
  },
  {
    title: 'Naturvärden och biologisk mångfald', slug: 'naturvarden-och-biologisk-mangfald',
    intro: 'Vilka naturvärden finns i Rögleskogen och hur påverkas de?',
    content: block([
      { type: 'paragraph', text: 'Området innehåller äldre lövskog med inslag av ek och hassel. Naturvärdesinventeringen har pekat ut flera nyckelbiotoper och förekomst av rödlistade arter.' },
      { type: 'heading', text: 'Skyddsvärda strukturer' },
      { type: 'paragraph', text: 'Stående döda träd, äldre hålträd och död ved är viktiga livsmiljöer för insekter, fåglar och svampar.' },
    ]),
    status: 'published', sort_order: 2, published_at: daysAgo(9),
  },
  {
    title: 'Trafik och transporter', slug: 'trafik-och-transporter',
    intro: 'Hur många tunga transporter innebär täkten och vilka vägar berörs?',
    content: block([
      { type: 'paragraph', text: 'Uttransport av krossad sten sker med lastbil. Antalet transporter beror på produktionsvolym och avsättning, och kan innebära en märkbar ökning av tung trafik på lokala vägar.' },
      { type: 'factbox', title: 'Frågor att ställa', text: 'Vilka vägar används? Hur påverkas trafiksäkerheten vid skolor och bostäder? Finns planer på nya anslutningsvägar?' },
    ]),
    status: 'published', sort_order: 3, published_at: daysAgo(8),
  },
]

// ---- documents -------------------------------------------------------------
const documents = [
  { title: 'NCC:s ansökan om täkttillstånd', description: 'Fullständig ansökan inlämnad till Länsstyrelsen i Skåne.', external_url: 'https://www.lansstyrelsen.se/skane', document_date: '2024-06-03', sender: 'NCC AB', sender_type: 'ncc', file_type: 'PDF', source: 'Länsstyrelsen Skåne', status: 'published', published_at: daysAgo(5) },
  { title: 'Naturvärdesinventering Rögleskogen', description: 'Oberoende inventering av naturvärden inom det planerade täktområdet.', external_url: 'https://artfakta.se', document_date: '2024-05-28', sender: 'Oberoende konsult', sender_type: 'initiative', file_type: 'PDF', source: 'Initiativet Rädda Rögleskogen', status: 'published', published_at: daysAgo(20) },
  { title: 'Samrådsunderlag', description: 'Underlag inför samråd med myndigheter och allmänhet.', external_url: 'https://www.lansstyrelsen.se/skane', document_date: '2024-04-15', sender: 'NCC AB', sender_type: 'ncc', file_type: 'PDF', source: 'Länsstyrelsen Skåne', status: 'published', published_at: daysAgo(25) },
  { title: 'Bullerutredning', description: 'Beräkning av förväntade ljudnivåer vid närliggande bostäder.', document_date: '2024-05-10', sender: 'NCC AB', sender_type: 'ncc', file_type: 'PDF', status: 'published', published_at: daysAgo(15) },
  { title: 'Yttrande från Lunds kommun', description: 'Kommunens preliminära synpunkter i ärendet.', external_url: 'https://lund.se', document_date: '2024-06-20', sender: 'Lunds kommun', sender_type: 'lund_kommun', file_type: 'PDF', source: 'Lunds kommun', status: 'published', published_at: daysAgo(3) },
]

// ---- timeline --------------------------------------------------------------
const timeline = [
  { event_date: '2024-03-01', title: 'NCC informerar om planerna', description: 'NCC meddelar avsikt att ansöka om tillstånd för bergtäkt i Rögleskogen.', event_type: 'Information', status: 'published', sort_order: 0, published_at: daysAgo(40) },
  { event_date: '2024-04-15', title: 'Samråd inleds', description: 'Samrådsunderlag publiceras och berörda ges möjlighet att lämna synpunkter.', event_type: 'Process', status: 'published', sort_order: 1, published_at: daysAgo(25) },
  { event_date: '2024-05-28', title: 'Naturvärdesinventering klar', description: 'Oberoende inventering identifierar höga naturvärden i området.', event_type: 'Rapport', status: 'published', sort_order: 2, published_at: daysAgo(20) },
  { event_date: '2024-06-03', title: 'Ansökan lämnas in', description: 'NCC lämnar in formell ansökan till Länsstyrelsen i Skåne.', event_type: 'Process', status: 'published', sort_order: 3, published_at: daysAgo(5) },
  { event_date: '2024-06-25', title: 'Informationsmöte med kommunen', description: 'Lunds kommun bjuder in allmänheten till informationsmöte.', event_type: 'Möte', status: 'published', sort_order: 4, published_at: daysAgo(2) },
]

// ---- contacts --------------------------------------------------------------
const contacts = [
  { name: 'Initiativet Rädda Rögleskogen', role: 'Medborgarinitiativ', email: 'kontakt@raddarogleskogen.se', is_public: true, sort_order: 0 },
  { name: 'Lunds kommun — Miljöförvaltningen', role: 'Kommunal förvaltning', email: 'miljoforvaltningen@lund.se', phone: '046-359 50 00', is_public: true, sort_order: 1 },
  { name: 'Länsstyrelsen Skåne', role: 'Tillståndsmyndighet', email: 'skane@lansstyrelsen.se', phone: '010-224 10 00', is_public: true, sort_order: 2 },
]

// ---- testimonies (approved) ------------------------------------------------
const testimonies = [
  { title: 'Vår tystnad försvinner', story: 'Vi har bott vid skogsbrynet i över 20 år. Det som lockade oss hit var lugnet. Tanken på dagliga sprängningar och tung trafik oroar hela familjen.', author_name: 'Anna', location: 'Södra Sandby', area_usage: 'Boende', status: 'approved', consent_publish: true, consent_contact: false, published_at: daysAgo(12) },
  { title: 'Skogen är vårt vardagsrum', story: 'Jag går i skogen varje morgon med hunden. Promenadstråken används av många i byn. Det vore en stor förlust om området försvann.', author_name: 'Lennart', location: 'Dalby', area_usage: 'Friluftsliv', status: 'approved', consent_publish: true, consent_contact: true, published_at: daysAgo(8) },
  { title: 'Oro för dricksvattnet', story: 'Vi har egen brunn och är oroliga för hur grundvattnet påverkas om man bryter berg under grundvattennivån. Vi vill se tydliga garantier.', is_anonymous: true, location: 'Området kring Rögleskogen', area_usage: 'Boende', status: 'approved', consent_publish: true, consent_contact: false, published_at: daysAgo(4) },
]

// ---- FAQ (categories first, then items linked by category id) -------------
async function seedFaq() {
  if (!(await isEmpty('faq_items'))) return
  // categories may already exist from a previous partial run — reuse if so
  let cats = (await databases.listDocuments({ databaseId: DB, collectionId: 'faq_categories' })).documents
  if (cats.length === 0) {
    const defs = [
      { name: 'Allmänt', slug: 'allmant', sort_order: 0 },
      { name: 'Miljö & hälsa', slug: 'miljo-halsa', sort_order: 1 },
      { name: 'Process & tillstånd', slug: 'process-tillstand', sort_order: 2 },
    ]
    cats = []
    for (const d of defs) cats.push(await create('faq_categories', d))
    console.log(`✓ faq_categories: seeded ${cats.length} row(s)`)
  } else {
    console.log(`• faq_categories: reusing ${cats.length} existing row(s)`)
  }
  const bySlug = Object.fromEntries(cats.map(c => [c.slug, c.$id]))
  const items = [
    { question: 'Vad är det som planeras i Rögleskogen?', answer: 'NCC har ansökt om tillstånd för en bergtäkt (stenbrott) mellan Södra Sandby och Dalby i Lunds kommun.', category_id: bySlug['allmant'], sort_order: 0 },
    { question: 'Vem driver den här sidan?', answer: 'Sidan drivs av det ideella medborgarinitiativet Rädda Rögleskogen och samlar information om ärendet.', category_id: bySlug['allmant'], sort_order: 1 },
    { question: 'Hur påverkas bullernivåerna?', answer: 'Buller uppstår från borrning, sprängning, krossning och transporter. En bullerutredning ska visa att gällande riktvärden vid bostäder kan innehållas.', category_id: bySlug['miljo-halsa'], sort_order: 0 },
    { question: 'Påverkas mitt dricksvatten?', answer: 'Brytning under grundvattennivån kan sänka grundvattnet lokalt och påverka enskilda brunnar. Kontrollprogram och ersättningsvatten är viktiga frågor.', category_id: bySlug['miljo-halsa'], sort_order: 1 },
    { question: 'Var i processen befinner sig ärendet?', answer: 'Ansökan har lämnats in till Länsstyrelsen i Skåne, som prövar den och ger berörda möjlighet att yttra sig.', category_id: bySlug['process-tillstand'], sort_order: 0 },
    { question: 'Hur kan jag lämna synpunkter?', answer: 'Under samrådstiden och remissförfarandet kan allmänheten yttra sig till Länsstyrelsen. Se sidan Dokument och Tidslinje för aktuella datum.', category_id: bySlug['process-tillstand'], sort_order: 1 },
  ]
  for (const it of items) await create('faq_items', { ...it, status: 'published', published_at: daysAgo(10) })
  console.log(`✓ faq_items: seeded ${items.length} row(s)`)
}

async function main() {
  await seed('topics', topics)
  await seed('documents', documents)
  await seed('timeline_events', timeline)
  await seed('contacts', contacts)
  await seed('testimonies', testimonies)
  await seedFaq()
  console.log('\n✅ Seed complete.')
}
main().catch(e => { console.error('\n❌', e.message || e); process.exit(1) })
