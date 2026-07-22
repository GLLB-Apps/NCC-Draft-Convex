// Bygger intranätet: en inloggningsskyddad yta för projektgrupper och aktiva,
// separat från den publika sidan och från admin.
//
// Säkerhetsmodell: allt intranätsinnehåll läses och skrivs bara av konton med
// Appwrite-labeln "member" eller "admin". Labeln sätts server-side (se
// api/set-member.js) — en databasrad räcker inte, precis som för admin.
//
// OBS: filerna i dokumentbanken ligger kvar i den publika media-bucketen tills
// vidare (medvetet val — privat lagring är ett senare steg). Metadatan skyddas,
// men en fil-URL som läcker är fortfarande nedladdningsbar.
//
// Kör lokalt:  node scripts/appwrite-add-intranet.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Storage } from 'node-appwrite'

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
const storage = new Storage(client)
const BUCKET = process.env.VITE_APPWRITE_BUCKET_ID || 'media'

// Intranätsinnehåll: både medlemmar och admins läser och skriver.
const roles = ['label:admin', 'label:member']
const INTRANET = roles.flatMap(r => [`read("${r}")`, `create("${r}")`, `update("${r}")`, `delete("${r}")`])
// Medlemsregistret: alla inloggade medlemmar/admins får läsa (så appen kan avgöra
// vem som är medlem), men bara admins får ändra vem som är med.
const MEMBERS = [
  'read("label:admin")', 'read("label:member")',
  'create("label:admin")', 'update("label:admin")', 'delete("label:admin")',
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = m => console.log('  ✓', m)
async function ignoreExists(p, label) {
  try { await p; ok(label) } catch (e) {
    if (e?.code === 409) console.log('  •', label, '(finns)')
    else throw e
  }
}

const S = (key, size = 255, required = false, def = null) => ({ fn: 'createStringAttribute', args: { key, size, required, ...(required ? {} : { default: def }) } })
const TXT = (key, required = false) => ({ fn: 'createStringAttribute', args: { key, size: 100000, required, ...(required ? {} : { default: null }) } })
const INT = (key, def = 0) => ({ fn: 'createIntegerAttribute', args: { key, required: false, default: def } })
const BOOL = (key, def = false) => ({ fn: 'createBooleanAttribute', args: { key, required: false, default: def } })

const schema = [
  {
    id: 'intranet_members', name: 'Intranet Members', perms: MEMBERS,
    attrs: [S('user_id', 64, true), S('display_name'), S('email'), S('added_by', 64), S('note', 500)],
    indexes: ['user_id'],
  },
  {
    id: 'intranet_notes', name: 'Intranet Notes', perms: INTRANET,
    // body är markdown/fritext; kategori grupperar (t.ex. "Möten", "Strategi").
    attrs: [S('title', 255, true), TXT('body'), S('category'), BOOL('pinned', false),
      S('created_by', 64), S('created_by_name'), INT('sort_order', 0)],
    indexes: ['category', 'pinned'],
  },
  {
    id: 'intranet_tasks', name: 'Intranet Tasks', perms: INTRANET,
    // Delad att-göra-lista. list grupperar poster; done markerar avklarat.
    attrs: [S('text', 1000, true), BOOL('done', false), S('list'), S('assignee'),
      S('due_date', 32), S('created_by', 64), S('done_by'), INT('sort_order', 0)],
    indexes: ['list', 'done'],
  },
  {
    id: 'intranet_notices', name: 'Intranet Notices', perms: INTRANET,
    // Anslagstavla — korta meddelanden, senaste först.
    attrs: [S('title', 255, true), TXT('body'), S('author'), S('author_id', 64), BOOL('pinned', false)],
    indexes: ['pinned'],
  },
]

for (const col of schema) {
  console.log(`\nKollektion: ${col.id}`)
  await ignoreExists(
    databases.createCollection({ databaseId: DB, collectionId: col.id, name: col.name, permissions: col.perms, documentSecurity: false }),
    `collection ${col.id}`,
  )
  for (const a of col.attrs) {
    await ignoreExists(databases[a.fn]({ databaseId: DB, collectionId: col.id, ...a.args }), `attr ${a.args.key}`)
  }
}

// Vänta tills attributen är tillgängliga innan index skapas.
for (const col of schema) {
  for (let i = 0; i < 30; i++) {
    const res = await databases.listAttributes({ databaseId: DB, collectionId: col.id })
    const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
    if (col.attrs.every(a => byKey[a.args.key] === 'available')) break
    await sleep(1000)
  }
  for (const key of col.indexes ?? []) {
    await ignoreExists(
      databases.createIndex({ databaseId: DB, collectionId: col.id, key: `idx_${key}`, type: 'key', attributes: [key] }),
      `index ${col.id}.${key}`,
    )
  }
}

// Vidga den befintliga dokumentbanken så att medlemmar också når den.
console.log('\nVidgar interna dokument till medlemmar')
for (const id of ['internal_documents', 'internal_doc_categories']) {
  try {
    await databases.updateCollection({
      databaseId: DB, collectionId: id, name: id === 'internal_documents' ? 'Internal Documents' : 'Internal Doc Categories',
      permissions: INTRANET, documentSecurity: false,
    })
    ok(`${id} → medlem + admin`)
  } catch (e) {
    if (e?.code === 404) console.log(`  • ${id} finns inte än — kör appwrite-internal-docs.mjs först`)
    else throw e
  }
}

// Låt medlemmar ladda upp filer (dokumentbanken behöver det). Bucketen är
// gemensam med publik media; radering hålls kvar hos admin så att medlemmar
// inte kan ta bort publika bilder. Läsning förblir "any" (filsäkerhet är ett
// senare steg — se skriptets topp).
console.log('\nVidgar media-bucketen så medlemmar kan ladda upp')
try {
  await storage.updateBucket({
    bucketId: BUCKET, name: 'Media',
    permissions: [
      'read("any")',
      'create("label:admin")', 'create("label:member")',
      'update("label:admin")', 'update("label:member")',
      'delete("label:admin")',
    ],
    fileSecurity: false, enabled: true,
    maximumFileSize: 30000000,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'pdf'],
  })
  ok(`bucket ${BUCKET} → medlemmar kan ladda upp`)
} catch (e) {
  if (e?.code === 404) console.log(`  • bucket ${BUCKET} finns inte`)
  else throw e
}

console.log('\n✅ Klart.')
