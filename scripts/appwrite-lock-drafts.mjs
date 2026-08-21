// Stänger hålet där utkast gick att läsa direkt mot databasen.
//
// Bakgrund: innehållskollektionerna hade read("any") på KOLLEKTIONSNIVÅ, och
// appen filtrerade på status i klienten. Filtret är alltså ingen gräns — vem
// som helst kunde lista opublicerat innehåll med projekt-id:t som ändå ligger
// i klientbygget.
//
// Efter körning gäller i stället:
//   • kollektionen släpper bara in admin för läsning
//   • varje PUBLICERAT dokument bär sin egen read("any")
//   • utkast, granskning, arkiverat och avvisat bär ingen läsrätt alls
//
// Ordningen är viktig: dokumentens rättigheter fylls i FÖRST, medan
// kollektionen fortfarande är öppen, och först därefter stängs kollektionen.
// Då finns det aldrig ett ögonblick där publicerat innehåll är oåtkomligt.
//
// Kräver att appen är driftsatt med permissionsFor() i src/lib/supabase.ts,
// annars får nytt innehåll som publiceras ingen läsrätt.
//
// Idempotent. Kör lokalt:  node scripts/appwrite-lock-drafts.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Query } from 'node-appwrite'

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

// Måste stämma med PUBLIC_WHEN i src/lib/supabase.ts.
const PUBLIC_WHEN = {
  posts: ['published'],
  topics: ['published'],
  documents: ['published'],
  media_items: ['published'],
  map_areas: ['published'],
  map_locations: ['published'],
  timeline_events: ['published'],
  faq_items: ['published'],
  custom_pages: ['published'],
  testimonies: ['approved'],
}

const READ_ANY = 'read("any")'
const READ_ADMIN = 'read("label:admin")'
const sameSet = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|')

let flaggade = 0
let dolda = 0

for (const [col, states] of Object.entries(PUBLIC_WHEN)) {
  let meta
  try {
    meta = await db.getCollection({ databaseId: DB, collectionId: col })
  } catch (e) {
    if (e?.code === 404) { console.log(`• ${col} finns inte – hoppas över`); continue }
    throw e
  }

  // 1) Rättigheter per dokument, medan kollektionen ännu är öppen.
  const res = await db.listDocuments({ databaseId: DB, collectionId: col, queries: [Query.limit(500)] })
  let publika = 0
  let stängda = 0
  for (const d of res.documents) {
    const skaVaraPublik = states.includes(d.status)
    const nu = d.$permissions ?? []
    const bör = skaVaraPublik ? [READ_ANY] : []
    // Behåll ev. andra rättigheter någon satt för hand; byt bara ut läsraden.
    const övriga = nu.filter(p => !p.startsWith('read('))
    const nästa = [...övriga, ...bör]
    if (!sameSet(nu, nästa)) {
      await db.updateDocument({ databaseId: DB, collectionId: col, documentId: d.$id, permissions: nästa })
    }
    if (skaVaraPublik) publika++; else stängda++
  }
  flaggade += publika
  dolda += stängda

  // 2) Stäng kollektionen. Bara läsraden byts – create/update/delete lämnas som de är.
  const behåll = (meta.$permissions ?? []).filter(p => !p.startsWith('read('))
  const nyaPerms = [...behåll, READ_ADMIN]
  const redanStängd = meta.documentSecurity && !(meta.$permissions ?? []).includes(READ_ANY)
  if (!redanStängd) {
    await db.updateCollection({
      databaseId: DB, collectionId: col, name: meta.name,
      permissions: nyaPerms, documentSecurity: true,
    })
  }
  console.log(`✓ ${col.padEnd(16)} ${String(publika).padStart(3)} publika · ${String(stängda).padStart(3)} dolda${redanStängd ? ' (kollektionen redan stängd)' : ''}`)
}

// 3) Profiler: presentationstexten är personlig och ska inte ligga öppen.
//    Inloggade behöver läsa dem (adminvyn, notisräknarna), gäster behöver inte.
//    create("any") lämnas kvar – nya konton skapar sin rad innan de har session.
{
  const meta = await db.getCollection({ databaseId: DB, collectionId: 'profiles' })
  const perms = meta.$permissions ?? []
  if (perms.includes(READ_ANY)) {
    const behåll = perms.filter(p => !p.startsWith('read('))
    await db.updateCollection({
      databaseId: DB, collectionId: 'profiles', name: meta.name,
      permissions: [...behåll, 'read("users")'], documentSecurity: meta.documentSecurity,
    })
    console.log('✓ profiles         läsning: any → users')
  } else {
    console.log('• profiles         redan stängd för gäster')
  }
}

console.log(`\n${flaggade} dokument är publikt läsbara, ${dolda} är det inte längre.`)
console.log('✅ Klart.')
