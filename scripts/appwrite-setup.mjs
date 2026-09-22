// Appwrite backend setup — creates the database, collections, attributes,
// indexes, permissions, and the initial superuser.
// Run locally:  node scripts/appwrite-setup.mjs
// Reads config from .env.local (never commit that file).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Users, ID } from 'node-appwrite'

// ---- load .env.local -------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}

const ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT
const PROJECT = process.env.VITE_APPWRITE_PROJECT_ID
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'
const API_KEY = process.env.APPWRITE_API_KEY
const SU_EMAIL = process.env.APPWRITE_SUPERUSER_EMAIL
const SU_PASS = process.env.APPWRITE_SUPERUSER_PASSWORD
const SU_NAME = process.env.APPWRITE_SUPERUSER_NAME || 'Admin'

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY)
const databases = new Databases(client)
const users = new Users(client)

// ---- permission + role string helpers -------------------------------------
const ANY = 'any', USERS = 'users', ADMIN = 'label:admin'
const rd = r => `read("${r}")`, cr = r => `create("${r}")`
const up = r => `update("${r}")`, dl = r => `delete("${r}")`
// content collections: public read, admin (label) write
const CONTENT = [rd(ANY), cr(ADMIN), up(ADMIN), dl(ADMIN)]

// ---- attribute DSL ---------------------------------------------------------
const s = (key, size = 255, required = false, def) => ({ t: 's', key, size, required, def })
const txt = (key, required = false, def) => ({ t: 's', key, size: 100000, required, def })
const url = (key) => ({ t: 's', key, size: 2000, required: false })
const i = (key, def) => ({ t: 'i', key, required: false, def })
const f = (key) => ({ t: 'f', key, required: false })
const b = (key, def) => ({ t: 'b', key, required: false, def })
const en = (key, elements, required = false, def) => ({ t: 'e', key, elements, required, def })

const STATUS4 = ['draft', 'review', 'published', 'archived']
const STATUS3 = ['draft', 'published', 'archived']
const SENDER = ['ncc', 'lund_kommun', 'authority', 'media', 'initiative', 'private']
const MEDIA = ['image', 'video', 'map', 'graphic', 'press_image']
const POINT = ['work_area', 'quarry_area', 'property_border', 'transport_route', 'residence_distance', 'nature_value', 'walking_trail', 'observation_point', 'photo_point', 'testimony_point']

// ---- schema ----------------------------------------------------------------
const schema = [
  {
    id: 'user_roles', name: 'User Roles',
    perms: [rd(USERS), cr(ADMIN), up(ADMIN), dl(ADMIN)],
    attrs: [s('user_id', 64, true), en('role', ['superadmin', 'redaktor', 'skribent'], true)],
    indexes: ['user_id'],
  },
  {
    id: 'profiles', name: 'Profiles',
    perms: [rd(ANY), cr(USERS), up(USERS), dl(ADMIN)],
    attrs: [s('display_name')],
    indexes: [],
  },
  {
    id: 'site_settings', name: 'Site Settings',
    perms: CONTENT,
    attrs: [
      s('site_name'), txt('site_subtitle'), url('logo_url'), url('favicon_url'),
      url('petition_url'), url('default_share_image'), s('contact_email'), s('contact_phone'),
      txt('social_links'), txt('footer_text'), txt('privacy_text'), txt('cookie_text'),
      txt('status_message'), s('status_phase'), s('next_important_date'), i('signature_count', 0),
      s('hero_title'), txt('hero_intro'), url('hero_image'), txt('background_blocks'),
      en('blob_avatars', ['off', 'admin', 'everywhere'], false, 'everywhere'),
    ],
    indexes: [],
  },
  {
    id: 'topics', name: 'Topics',
    perms: CONTENT,
    attrs: [
      s('title'), s('slug'), txt('intro'), txt('content'),
      en('status', STATUS4, false, 'draft'), url('featured_image'), i('sort_order', 0),
      s('created_by', 64), s('updated_by', 64), s('published_at'),
    ],
    indexes: ['slug', 'status', 'sort_order', 'published_at'],
  },
  {
    id: 'posts', name: 'Posts',
    perms: CONTENT,
    attrs: [
      s('title'), s('slug'), txt('excerpt'), txt('content'), url('featured_image'),
      txt('image_caption'), s('author'), en('status', STATUS4, false, 'draft'),
      b('is_pinned', false), s('seo_title'), txt('seo_description'), s('published_at'),
      s('created_by', 64), s('updated_by', 64),
    ],
    indexes: ['slug', 'status', 'is_pinned', 'published_at'],
  },
  {
    id: 'testimonies', name: 'Testimonies',
    perms: [rd(ANY), cr(ANY), up(ADMIN), dl(ADMIN)],
    attrs: [
      s('title'), txt('story'), s('author_name'), b('is_anonymous', false), s('email'),
      s('location'), txt('area_usage'), url('featured_image'), f('map_lat'), f('map_lng'),
      en('status', ['pending', 'approved', 'rejected', 'archived'], false, 'pending'),
      b('consent_publish', false), b('consent_contact', false), txt('internal_note'), s('published_at'),
    ],
    indexes: ['status', 'published_at'],
  },
  {
    id: 'documents', name: 'Documents',
    perms: CONTENT,
    attrs: [
      s('title'), txt('description'), url('file_url'), url('external_url'), s('document_date'),
      s('sender'), en('sender_type', SENDER), s('file_type'), s('source'),
      en('status', STATUS3, false, 'draft'), s('published_at'), s('created_by', 64), s('updated_by', 64),
    ],
    indexes: ['status', 'sender_type', 'published_at'],
  },
  {
    id: 'media_items', name: 'Media Items',
    perms: CONTENT,
    attrs: [
      s('title'), txt('description'), txt('alt_text'), s('photographer'), s('media_date'),
      s('location'), en('media_type', MEDIA, false, 'image'), url('file_url'), url('video_url'),
      txt('rights_info'), b('is_press_allowed', false), en('status', STATUS3, false, 'draft'),
      s('published_at'), s('created_by', 64), s('updated_by', 64),
    ],
    indexes: ['status', 'media_type', 'is_press_allowed', 'published_at'],
  },
  {
    id: 'map_locations', name: 'Map Locations',
    perms: CONTENT,
    attrs: [
      s('title'), txt('description'), f('lat'), f('lng'), en('point_type', POINT, false, 'work_area'),
      url('image_url'), s('source'), en('status', STATUS3, false, 'draft'), s('published_at'),
      s('created_by', 64), s('updated_by', 64),
    ],
    indexes: ['status', 'published_at'],
  },
  {
    id: 'timeline_events', name: 'Timeline Events',
    perms: CONTENT,
    attrs: [
      s('event_date'), s('title'), txt('description'), s('event_type'), url('link_url'),
      s('related_document_id', 64), url('image_url'), en('status', STATUS3, false, 'draft'),
      s('published_at'), i('sort_order', 0), s('created_by', 64), s('updated_by', 64),
    ],
    indexes: ['status', 'event_date', 'sort_order', 'published_at'],
  },
  {
    id: 'faq_categories', name: 'FAQ Categories',
    perms: CONTENT,
    attrs: [s('name'), s('slug'), i('sort_order', 0)],
    indexes: ['sort_order'],
  },
  {
    id: 'faq_items', name: 'FAQ Items',
    perms: CONTENT,
    attrs: [
      txt('question'), txt('answer'), s('category_id', 64), i('sort_order', 0),
      en('status', STATUS3, false, 'draft'), s('published_at'),
    ],
    indexes: ['status', 'sort_order', 'published_at'],
  },
  {
    id: 'contacts', name: 'Contacts',
    perms: CONTENT,
    attrs: [s('name'), s('role'), s('email'), s('phone'), b('is_public', true), i('sort_order', 0)],
    indexes: ['is_public', 'sort_order'],
  },
  {
    id: 'contact_messages', name: 'Contact Messages',
    perms: [rd(ADMIN), cr(ANY), up(ADMIN), dl(ADMIN)],
    attrs: [
      s('name'), s('email'), s('subject'), txt('message'),
      en('status', ['unread', 'read', 'handled', 'archived'], false, 'unread'), txt('internal_note'),
    ],
    indexes: ['status'],
  },
  {
    id: 'navigation_items', name: 'Navigation Items',
    perms: CONTENT,
    attrs: [s('label'), url('url'), i('sort_order', 0), b('is_active', true)],
    indexes: ['is_active', 'sort_order'],
  },
  {
    id: 'audit_log', name: 'Audit Log',
    perms: [rd(ADMIN), cr(ADMIN)],
    attrs: [s('user_id', 64), s('action'), s('entity_type'), s('entity_id', 64), txt('details')],
    indexes: [],
  },
]

// ---- helpers ---------------------------------------------------------------
const ok = (label) => console.log('  ✓', label)
async function ignoreExists(promise, label) {
  try { await promise; ok(label) }
  catch (e) {
    if (e?.code === 409) console.log('  •', label, '(exists)')
    else throw e
  }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function createAttr(colId, a) {
  const base = { databaseId: DB, collectionId: colId, key: a.key, required: a.required }
  if (a.t === 's') return databases.createStringAttribute({ ...base, size: a.size, default: a.required ? undefined : (a.def ?? null) })
  if (a.t === 'i') return databases.createIntegerAttribute({ ...base, default: a.required ? undefined : (a.def ?? null) })
  if (a.t === 'f') return databases.createFloatAttribute({ ...base, default: a.required ? undefined : (a.def ?? null) })
  if (a.t === 'b') return databases.createBooleanAttribute({ ...base, default: a.required ? undefined : (a.def ?? null) })
  if (a.t === 'e') return databases.createEnumAttribute({ ...base, elements: a.elements, default: a.required ? undefined : (a.def ?? null) })
}

async function waitForAttributes(colId, keys) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await databases.listAttributes({ databaseId: DB, collectionId: colId })
    const byKey = Object.fromEntries(res.attributes.map(x => [x.key, x.status]))
    if (keys.every(k => byKey[k] === 'available')) return
    await sleep(1000)
  }
  throw new Error(`Attributes not available for ${colId}`)
}

// ---- run -------------------------------------------------------------------
async function main() {
  console.log('Endpoint:', ENDPOINT, '\nProject :', PROJECT, '\nDatabase:', DB, '\n')

  console.log('Database')
  await ignoreExists(databases.create({ databaseId: DB, name: 'Main' }), `database "${DB}"`)

  for (const col of schema) {
    console.log(`\nCollection: ${col.id}`)
    await ignoreExists(
      databases.createCollection({ databaseId: DB, collectionId: col.id, name: col.name, permissions: col.perms, documentSecurity: false }),
      `collection ${col.id}`,
    )
    for (const a of col.attrs) await ignoreExists(createAttr(col.id, a), `attr ${a.key}`)
    await waitForAttributes(col.id, col.attrs.map(a => a.key))
    for (const key of col.indexes) {
      await ignoreExists(
        databases.createIndex({ databaseId: DB, collectionId: col.id, key: `idx_${key}`, type: 'key', attributes: [key] }),
        `index ${key}`,
      )
    }
  }

  // ---- superuser -----------------------------------------------------------
  console.log('\nSuperuser')
  let userId
  try {
    const u = await users.create({ userId: ID.unique(), email: SU_EMAIL, password: SU_PASS, name: SU_NAME })
    userId = u.$id
    ok(`created user ${SU_EMAIL}`)
  } catch (e) {
    if (e?.code === 409) {
      const list = await users.list({ search: SU_EMAIL })
      userId = list.users.find(x => x.email?.toLowerCase() === SU_EMAIL.toLowerCase())?.$id || list.users[0]?.$id
      console.log('  •', `user ${SU_EMAIL} exists →`, userId)
    } else throw e
  }

  await ignoreExists(users.updateLabels({ userId, labels: ['admin'] }), 'label admin')

  // wait for user_roles / profiles / site_settings attrs, then seed docs
  await waitForAttributes('user_roles', ['user_id', 'role'])
  await ignoreExists(
    databases.createDocument({ databaseId: DB, collectionId: 'user_roles', documentId: ID.unique(), data: { user_id: userId, role: 'superadmin' } }),
    'user_roles row (superadmin)',
  )
  await ignoreExists(
    databases.createDocument({ databaseId: DB, collectionId: 'profiles', documentId: userId, data: { display_name: SU_NAME } }),
    'profiles row',
  )
  await ignoreExists(
    databases.createDocument({
      databaseId: DB, collectionId: 'site_settings', documentId: ID.unique(),
      data: {
        site_name: 'Rögleskogen',
        site_subtitle: 'Information om den planerade bergtäkten mellan Södra Sandby och Dalby',
        petition_url: 'https://www.skrivunder.com/',
        social_links: '{}', signature_count: 0,
        hero_title: 'Ett nytt stenbrott planeras i Rögleskogen',
        hero_intro: 'NCC har informerat om planer på att ansöka om tillstånd för en ny bergtäkt mellan Södra Sandby och Dalby. Här samlas information, dokument, bilder, vittnesmål och frågor om hur området och närområdet kan påverkas.',
        background_blocks: '[]',
      },
    }),
    'site_settings row',
  )

  console.log('\n✅ Done. User id:', userId)
}

main().catch(e => { console.error('\n❌', e.message || e); process.exit(1) })
