'use node'

// Engångsimport av riktigt innehåll från den levande Appwrite-installationen
// (NCC-Draft-RS) in i detta FÄRSKA, tomma Convex-projekt — TS-port av
// d:\Programmering\NCC-Draft-PHP\scripts\import-appwrite-data.php, samma
// fältmappningar och samma försiktighet, men enklare på ett par punkter:
//
//   - Ingen --force/redan-importerad-koll behövs: detta körs mot en tom
//     databas, inte en som redan kan ha data (PHP-skriptet skulle kunna köras
//     om mot en delvis fylld SQLite/JSON-mapp, den risken finns inte här).
//   - Konton skapas via Convex Auths createAccount() (en antagen, OVERIFIERAD
//     signatur i skrivande stund — samma sorts osäkerhet som
//     modifyAccountCredentials hade innan den riktiga tsc-körningen rättade
//     den; verifiera/justera här på samma sätt om den klagar).
//
// Körs EN gång via:
//   npx convex run migrateAppwrite:run '{"endpoint":"...","project":"...","apiKey":"...","databaseId":"...","bucketId":"..."}'
//
// Läser ALDRIG riktiga lösenord (Appwrite exponerar aldrig dem) — nya konton
// får ett slumpat lösenord, samma som PHP-skriptets import/generated-passwords.txt,
// returnerat i resultatet istället för skrivet till en fil (ingen filsystems-
// åtkomst att lita på i en Convex action).

import { v } from 'convex/values'
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { createAccount } from '@convex-dev/auth/server'

interface AppwriteDoc { $id: string; $createdAt: string; $updatedAt: string; [key: string]: unknown }

class AppwriteClient {
  private endpoint: string
  private project: string
  private apiKey: string

  constructor(endpoint: string, project: string, apiKey: string) {
    this.endpoint = endpoint
    this.project = project
    this.apiKey = apiKey
  }

  private async get(path: string, queries: string[] = []): Promise<Record<string, unknown>> {
    const qs = queries.map(q => `queries[]=${encodeURIComponent(q)}`).join('&')
    const url = `${this.endpoint.replace(/\/$/, '')}${path}${qs ? `?${qs}` : ''}`
    const res = await fetch(url, { headers: { 'X-Appwrite-Project': this.project, 'X-Appwrite-Key': this.apiKey } })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(`Appwrite ${res.status} @ ${path}: ${JSON.stringify(data)}`)
    return data
  }

  async listAllDocuments(databaseId: string, collectionId: string): Promise<AppwriteDoc[]> {
    const all: AppwriteDoc[] = []
    let cursor: string | null = null
    for (;;) {
      const queries = [JSON.stringify({ method: 'limit', values: [100] })]
      if (cursor) queries.push(JSON.stringify({ method: 'cursorAfter', values: [cursor] }))
      const data = await this.get(`/databases/${databaseId}/collections/${collectionId}/documents`, queries)
      const docs = (data.documents as AppwriteDoc[] | undefined) ?? []
      all.push(...docs)
      if (docs.length < 100) break
      cursor = docs[docs.length - 1].$id
    }
    return all
  }

  async listAllUsers(): Promise<AppwriteDoc[]> {
    const all: AppwriteDoc[] = []
    let cursor: string | null = null
    for (;;) {
      const queries = [JSON.stringify({ method: 'limit', values: [100] })]
      if (cursor) queries.push(JSON.stringify({ method: 'cursorAfter', values: [cursor] }))
      const data = await this.get('/users', queries)
      const users = (data.users as AppwriteDoc[] | undefined) ?? []
      all.push(...users)
      if (users.length < 100) break
      cursor = users[users.length - 1].$id
    }
    return all
  }

  async listAllBucketFiles(bucketId: string): Promise<AppwriteDoc[]> {
    const all: AppwriteDoc[] = []
    let cursor: string | null = null
    for (;;) {
      const queries = [JSON.stringify({ method: 'limit', values: [100] })]
      if (cursor) queries.push(JSON.stringify({ method: 'cursorAfter', values: [cursor] }))
      const data = await this.get(`/storage/buckets/${bucketId}/files`, queries)
      const files = (data.files as AppwriteDoc[] | undefined) ?? []
      all.push(...files)
      if (files.length < 100) break
      cursor = files[files.length - 1].$id
    }
    return all
  }

  async downloadFile(bucketId: string, fileId: string): Promise<{ blob: Blob; contentType: string } | null> {
    const url = `${this.endpoint.replace(/\/$/, '')}/storage/buckets/${bucketId}/files/${fileId}/view`
    const res = await fetch(url, { headers: { 'X-Appwrite-Project': this.project, 'X-Appwrite-Key': this.apiKey } })
    if (!res.ok) return null
    return { blob: await res.blob(), contentType: res.headers.get('content-type') ?? 'application/octet-stream' }
  }
}

/** Skriver om varje sträng som pekar på en Appwrite Storage-fil till motsvarande Convex-URL, oavsett hur djupt nästlad. */
function rewriteFileUrls(value: unknown, fileMap: Map<string, string>, bucketId: string): unknown {
  if (Array.isArray(value)) return value.map(v => rewriteFileUrls(v, fileMap, bucketId))
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = rewriteFileUrls(v, fileMap, bucketId)
    return out
  }
  if (typeof value === 'string' && value.includes(`/buckets/${bucketId}/files/`)) {
    const m = value.match(new RegExp(`/buckets/${bucketId}/files/([^/]+)/(?:view|download)`))
    if (m) return fileMap.get(m[1]) ?? value
  }
  return value
}

function parseJsonField(v: unknown): unknown {
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) } catch { return v }
}

/** Appwrites systemfält bort, utvalda strängfält JSON-parsade, filreferenser omskrivna. */
function fromDoc(doc: AppwriteDoc, jsonFields: string[], fileMap: Map<string, string>, bucketId: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(doc)) {
    if (k.startsWith('$')) continue
    out[k] = jsonFields.includes(k) ? parseJsonField(val) : val
  }
  return rewriteFileUrls(out, fileMap, bucketId) as Record<string, unknown>
}

// Inte alla tabeller i schema.ts har created_at/updated_at (Convex validerar
// objekt stängt — en extra okänd fältnyckel är ett hårt fel, till skillnad
// från Appwrite som inte brydde sig). De flesta har båda; dessa avviker.
const NO_TIMESTAMPS = new Set(['navigationItems', 'faqCategories', 'contacts', 'internalDocCategories'])
const CREATED_ONLY = new Set(['customIcons'])

/** Lägger till created_at/updated_at (från Appwrites $createdAt/$updatedAt) om och bara om målschemat tillåter dem. */
function withTimestamps(row: Record<string, unknown>, doc: AppwriteDoc, table: string): Record<string, unknown> {
  if (NO_TIMESTAMPS.has(table)) return row
  if (CREATED_ONLY.has(table)) return { ...row, created_at: doc.$createdAt }
  return { ...row, created_at: doc.$createdAt, updated_at: doc.$updatedAt }
}

/** undefined istället för null/tomt — v.optional()-fält i schema.ts tillåter FRÅNVARO, inte alltid null. */
function dropNullish(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v
  return out
}

/** En korsreferens som inte kunde mappas om (källraden fanns inte / exporterades inte) — tas bort hellre än att peka fel. */
function dropKey(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  const { [key]: _omit, ...rest } = obj
  return rest
}

/**
 * Fallback för obligatoriska fält (schema.ts v.boolean()/v.number()/v.array(),
 * aldrig v.optional) som äldre Appwrite-dokument kan sakna helt — t.ex. ett
 * booleskt attribut som lades till i Appwrite-kollektionen EFTER att raden
 * skapades, aldrig efterifyllt. Upptäckt via den riktiga schemavalideringen
 * (mediaItems.marketing_ok saknades på en rad) — tillämpas generellt här
 * istället för att patcha ett fält i taget för varje tabell som råkar ha
 * samma problem. Riktiga värden i dokumentet vinner alltid över defaulten.
 */
const DEFAULTS: Record<string, Record<string, unknown>> = {
  navigationItems: { is_active: true, sort_order: 0 },
  faqCategories: { sort_order: 0 },
  contacts: { is_public: true, sort_order: 0 },
  sponsors: { is_active: true, sort_order: 0 },
  topics: { sort_order: 0 },
  posts: { is_pinned: false, tags: [] },
  mediaItems: { is_press_allowed: false, marketing_ok: false },
  timelineEvents: { sort_order: 0 },
  customPages: { sort_order: 0 },
  mapLocations: { lat: 0, lng: 0 },
  mapAreas: { fill_opacity: 1, points: [], sort_order: 0 },
  faqItems: { sort_order: 0 },
  testimonies: { is_anonymous: false, consent_publish: false, consent_contact: false, consent_marketing: false },
  intranetNotices: { pinned: false },
  intranetNotes: { pinned: false, sort_order: 0 },
  intranetTasks: { done: false, sort_order: 0 },
  internalDocCategories: { sort_order: 0 },
}
function withDefaults(row: Record<string, unknown>, table: string): Record<string, unknown> {
  const d = DEFAULTS[table]
  return d ? { ...d, ...row } : row
}

/**
 * Motsatta problemet mot DEFAULTS: den LIVE Appwrite-kollektionen har ibland
 * FLER attribut än både src/lib/types.ts och schema.ts känner till (t.ex.
 * timelineEvents.updated_by — fanns i Appwrite, aldrig dokumenterat eller
 * porterat). Convex schema är stängt: en extra okänd nyckel är ett hårt fel.
 * Vitlista per tabell = exakt fältnamnen från schema.ts, allt annat kapas
 * tyst bort här istället för att krascha importen.
 */
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  pages: new Set(['slug', 'title', 'intro', 'texts', 'blocks', 'created_at', 'updated_at']),
  navigationItems: new Set(['label', 'url', 'icon', 'sort_order', 'is_active', 'parent_id']),
  faqCategories: new Set(['name', 'slug', 'sort_order']),
  contacts: new Set(['name', 'role', 'email', 'phone', 'is_public', 'sort_order']),
  customIcons: new Set(['name', 'label', 'added_by', 'created_at']),
  changelogEntries: new Set(['title', 'body', 'entry_date', 'category', 'version', 'commit_sha', 'created_by', 'created_by_name', 'created_at', 'updated_at']),
  sponsors: new Set(['name', 'image_url', 'link_url', 'sort_order', 'is_active', 'created_at', 'updated_at']),
  topics: new Set(['title', 'slug', 'intro', 'content', 'status', 'featured_image', 'icon', 'sort_order', 'created_by', 'updated_by', 'published_at', 'created_at', 'updated_at']),
  posts: new Set(['title', 'slug', 'excerpt', 'content', 'featured_image', 'image_caption', 'author', 'status', 'is_pinned', 'category', 'tags', 'source', 'external_url', 'seo_title', 'seo_description', 'published_at', 'created_by', 'updated_by', 'created_at', 'updated_at']),
  documents: new Set(['title', 'description', 'file_url', 'external_url', 'document_date', 'sender', 'sender_type', 'file_type', 'source', 'status', 'published_at', 'created_by', 'updated_by', 'created_at', 'updated_at']),
  mediaItems: new Set(['title', 'description', 'alt_text', 'photographer', 'media_date', 'location', 'media_type', 'file_url', 'video_url', 'rights_info', 'is_press_allowed', 'marketing_ok', 'status', 'published_at', 'created_by', 'updated_by', 'created_at', 'updated_at']),
  timelineEvents: new Set(['event_date', 'title', 'description', 'event_type', 'link_url', 'related_document_id', 'image_url', 'status', 'sort_order', 'published_at', 'created_at', 'updated_at']),
  customPages: new Set(['slug', 'title', 'intro', 'blocks', 'status', 'sort_order', 'published_at', 'created_at', 'updated_at']),
  mapLocations: new Set(['title', 'description', 'lat', 'lng', 'point_type', 'icon', 'image_url', 'source', 'status', 'published_at', 'created_at', 'updated_at']),
  mapAreas: new Set(['title', 'description', 'color', 'line_style', 'fill_opacity', 'icon', 'image_url', 'points', 'sort_order', 'status', 'published_at', 'created_at', 'updated_at']),
  faqItems: new Set(['question', 'answer', 'category_id', 'sort_order', 'status', 'published_at', 'created_at', 'updated_at']),
  testimonies: new Set(['title', 'story', 'author_name', 'is_anonymous', 'location', 'area_usage', 'featured_image', 'map_lat', 'map_lng', 'status', 'consent_publish', 'consent_contact', 'consent_marketing', 'published_at', 'created_at', 'updated_at']),
  testimonyContacts: new Set(['testimony_id', 'email', 'author_name', 'internal_note', 'created_at', 'updated_at']),
  contactMessages: new Set(['name', 'email', 'subject', 'message', 'status', 'internal_note', 'created_at', 'updated_at']),
  intranetNotices: new Set(['title', 'body', 'author', 'author_id', 'pinned', 'created_at', 'updated_at']),
  intranetNotes: new Set(['title', 'body', 'category', 'pinned', 'created_by', 'created_by_name', 'sort_order', 'created_at', 'updated_at']),
  intranetTasks: new Set(['text', 'done', 'list', 'assignee', 'due_date', 'created_by', 'done_by', 'sort_order', 'created_at', 'updated_at']),
  internalDocCategories: new Set(['name', 'sort_order']),
  internalDocuments: new Set(['title', 'description', 'file_url', 'file_name', 'file_type', 'file_size', 'category_id', 'owner', 'uploaded_by', 'uploaded_by_id', 'created_at', 'updated_at']),
}
function withAllowedFields(row: Record<string, unknown>, table: string): Record<string, unknown> {
  const allowed = ALLOWED_FIELDS[table]
  if (!allowed) return row // t.ex. siteSettings (v.any() — allt tillåtet)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) if (allowed.has(k)) out[k] = v
  return out
}

export const storeFile = internalAction({
  args: { endpoint: v.string(), project: v.string(), apiKey: v.string(), bucketId: v.string(), fileId: v.string() },
  handler: async (ctx, args) => {
    const client = new AppwriteClient(args.endpoint, args.project, args.apiKey)
    const file = await client.downloadFile(args.bucketId, args.fileId)
    if (!file) return null
    const storageId = await ctx.storage.store(file.blob)
    return await ctx.storage.getUrl(storageId)
  },
})

const JSON_FIELDS: Record<string, string[]> = {
  topics: ['content'],
  posts: ['content', 'tags'],
  site_settings: ['social_links', 'background_blocks', 'hero_buttons', 'important_dates'],
  pages: ['texts', 'blocks'],
  custom_pages: ['blocks'],
  map_areas: ['points'],
}

// Appwrite-kollektionsnamn (snake_case, så som anropsplatserna fortfarande
// använder dem via den oförändrade kompat-shimmen) -> Convex-tabellnamn.
const TABLE_MAP: Record<string, string> = {
  pages: 'pages', navigation_items: 'navigationItems', topics: 'topics', posts: 'posts',
  faq_categories: 'faqCategories', faq_items: 'faqItems', documents: 'documents',
  media_items: 'mediaItems', timeline_events: 'timelineEvents', contacts: 'contacts',
  custom_icons: 'customIcons', changelog_entries: 'changelogEntries', custom_pages: 'customPages',
  sponsors: 'sponsors', map_locations: 'mapLocations', map_areas: 'mapAreas',
  contact_messages: 'contactMessages',
  intranet_notices: 'intranetNotices', intranet_notes: 'intranetNotes', intranet_tasks: 'intranetTasks',
  internal_doc_categories: 'internalDocCategories', internal_documents: 'internalDocuments',
}

interface ImportArgs {
  endpoint: string
  project: string
  apiKey: string
  databaseId: string
  bucketId: string
  skipFiles?: boolean
}

export const run = internalAction({
  args: {
    endpoint: v.string(), project: v.string(), apiKey: v.string(),
    databaseId: v.string(), bucketId: v.string(), skipFiles: v.optional(v.boolean()),
  },
  handler: async (ctx, args: ImportArgs) => {
    const client = new AppwriteClient(args.endpoint, args.project, args.apiKey)
    const stats: Record<string, string> = {}

    // --- steg 1: alla filer i bucketen -> Convex Storage --------------------
    const fileMap = new Map<string, string>()
    if (!args.skipFiles) {
      const files = await client.listAllBucketFiles(args.bucketId)
      let done = 0
      for (const f of files) {
        const url = await ctx.runAction(internal.migrateAppwrite.storeFile, {
          endpoint: args.endpoint, project: args.project, apiKey: args.apiKey,
          bucketId: args.bucketId, fileId: f.$id,
        })
        if (url) { fileMap.set(f.$id, url); done++ }
      }
      stats.files = `${done}/${files.length} filer överförda till Convex Storage`
    } else {
      stats.files = 'hoppade över (--skip-files)'
    }

    // --- steg 2: vanliga innehållstabeller -----------------------------------
    // Appwrites $id ersätts av Convex's egna, nygenererade _id vid varje
    // insert — så ALLA korsreferenser mellan tabeller (inte bara
    // testimony_contacts.testimony_id, se steg 4) måste mappas om, annars
    // pekar de på ett id som inte längre existerar. idMaps[table] = gammalt
    // Appwrite-$id -> nytt Convex-_id, byggd i samma ordning TABLE_MAP redan
    // har (beroenden kommer före det som refererar dem: faqCategories före
    // faqItems, documents före timelineEvents, internalDocCategories före
    // internalDocuments).
    const idMaps: Record<string, Map<string, string>> = {}
    const CROSS_REF: Record<string, { field: string; refTable: string }> = {
      faqItems: { field: 'category_id', refTable: 'faqCategories' },
      internalDocuments: { field: 'category_id', refTable: 'internalDocCategories' },
      timelineEvents: { field: 'related_document_id', refTable: 'documents' },
    }

    for (const [awTable, table] of Object.entries(TABLE_MAP)) {
      const docs = await client.listAllDocuments(args.databaseId, awTable)
      const idMap = new Map<string, string>()
      idMaps[table] = idMap
      const ref = CROSS_REF[table]
      let n = 0
      for (const doc of docs) {
        let row = withAllowedFields(withDefaults(dropNullish(withTimestamps(fromDoc(doc, JSON_FIELDS[awTable] ?? [], fileMap, args.bucketId), doc, table)), table), table)
        if (ref && typeof row[ref.field] === 'string') {
          const mapped = idMaps[ref.refTable]?.get(row[ref.field] as string)
          row = mapped ? { ...row, [ref.field]: mapped } : dropKey(row, ref.field)
        }
        const newId: string = await ctx.runMutation(internal.migrateAppwriteDb.insertRow, { table, data: row })
        idMap.set(doc.$id, newId)
        n++
      }
      stats[awTable] = `${n} importerade`
    }

    // navigationItems.parent_id är självrefererande (en menyrad pekar på en
    // annan menyrad) — Appwrite garanterar ingen ordning där föräldern alltid
    // kommer före barnet, så den löses i en andra passage EFTER att alla rader
    // (och därmed hela id-kartan) finns.
    {
      const navMap = idMaps.navigationItems
      if (navMap) {
        const docs = await client.listAllDocuments(args.databaseId, 'navigation_items')
        let patched = 0
        for (const doc of docs) {
          const oldParent = doc.parent_id as string | undefined
          if (!oldParent) continue
          const newId = navMap.get(doc.$id)
          const newParent = navMap.get(oldParent)
          if (newId && newParent) {
            await ctx.runMutation(internal.migrateAppwriteDb.patchRow, { table: 'navigationItems', id: newId, patch: { parent_id: newParent } })
            patched++
          }
        }
        if (patched > 0) stats.navigation_items += `, ${patched} parent_id ombundna`
      }
    }

    // --- steg 3: site_settings (singleton) -----------------------------------
    {
      const docs = await client.listAllDocuments(args.databaseId, 'site_settings')
      if (docs.length > 0) {
        const row = dropNullish(fromDoc(docs[0], JSON_FIELDS.site_settings, fileMap, args.bucketId))
        await ctx.runMutation(internal.migrateAppwriteDb.insertRow, { table: 'siteSettings', data: row })
        stats.site_settings = 'importerad'
      } else {
        stats.site_settings = 'inga rader i Appwrite'
      }
    }

    // --- steg 4: testimonies (utan de utfasade email/internal_note-fälten) --
    // testimony_contacts.testimony_id pekar på det GAMLA Appwrite-$id:t — Convex
    // ger varje importerad testimony ett nytt, eget _id, så referensen måste
    // mappas om (testimonyIdMap: gammalt $id -> nytt Convex-id), annars pekar
    // kontaktposten på ingenting.
    const testimonyIdMap = new Map<string, string>()
    {
      const docs = await client.listAllDocuments(args.databaseId, 'testimonies')
      let n = 0
      for (const doc of docs) {
        const { email: _email, internal_note: _note, ...rest } = fromDoc(doc, [], fileMap, args.bucketId)
        const newId: string = await ctx.runMutation(internal.migrateAppwriteDb.insertRow, {
          table: 'testimonies', data: withAllowedFields(withDefaults(dropNullish(withTimestamps(rest, doc, 'testimonies')), 'testimonies'), 'testimonies'),
        })
        testimonyIdMap.set(doc.$id, newId)
        n++
      }
      stats.testimonies = `${n} importerade`
    }
    {
      const docs = await client.listAllDocuments(args.databaseId, 'testimony_contacts')
      let n = 0
      let orphaned = 0
      for (const doc of docs) {
        const newTestimonyId = testimonyIdMap.get(doc.testimony_id as string)
        if (!newTestimonyId) { orphaned++; continue } // motsvarande testimony importerades inte (borttagen/åtkomstfel i Appwrite)
        const row = withAllowedFields(dropNullish(withTimestamps({ ...fromDoc(doc, [], fileMap, args.bucketId), testimony_id: newTestimonyId }, doc, 'testimonyContacts')), 'testimonyContacts')
        await ctx.runMutation(internal.migrateAppwriteDb.insertRow, { table: 'testimonyContacts', data: row })
        n++
      }
      stats.testimony_contacts = `${n} importerade${orphaned ? `, ${orphaned} utan matchande testimony` : ''}`
    }

    // --- steg 5: konton (Appwrite Users + user_roles + profiles + intranet_members) --
    const awUsers = await client.listAllUsers()
    const roles = await client.listAllDocuments(args.databaseId, 'user_roles')
    const profiles = await client.listAllDocuments(args.databaseId, 'profiles')
    const members = await client.listAllDocuments(args.databaseId, 'intranet_members')

    interface Merged {
      email: string; display_name?: string; intro?: string
      role?: 'superadmin' | 'redaktor' | 'skribent'
      intranet_member?: boolean; intranet_read_only?: boolean
      notifications_seen?: Record<string, string>; notifications_cleared_at?: string
    }
    const merged = new Map<string, Merged>() // nyckel: Appwrite $id
    for (const u of awUsers) {
      merged.set(u.$id, { email: u.email as string, display_name: (u.name as string) || undefined })
    }
    for (const p of profiles) {
      const m = merged.get(p.$id)
      if (!m) continue
      if (p.display_name) m.display_name = p.display_name as string
      if (p.intro) m.intro = p.intro as string
      const seen = parseJsonField(p.notifications_seen)
      if (seen && typeof seen === 'object') m.notifications_seen = seen as Record<string, string>
      if (p.notifications_cleared_at) m.notifications_cleared_at = p.notifications_cleared_at as string
    }
    for (const r of roles) {
      const m = merged.get(r.user_id as string)
      if (m) m.role = r.role as Merged['role']
    }
    for (const mem of members) {
      const m = merged.get(mem.user_id as string)
      if (m) { m.intranet_member = true; m.intranet_read_only = !!mem.read_only }
    }

    const generatedPasswords: { email: string; password: string }[] = []
    let accountsCreated = 0
    for (const m of merged.values()) {
      const password = cryptoRandomPassword()
      try {
        await createAccount(ctx, {
          provider: 'password',
          account: { id: m.email, secret: password },
          profile: dropNullish({
            email: m.email, display_name: m.display_name, intro: m.intro,
            role: m.role, intranet_member: m.intranet_member, intranet_read_only: m.intranet_read_only,
            notifications_seen: m.notifications_seen, notifications_cleared_at: m.notifications_cleared_at,
          }) as { email: string },
        })
        generatedPasswords.push({ email: m.email, password })
        accountsCreated++
      } catch (e) {
        stats[`user:${m.email}`] = `FEL: ${e instanceof Error ? e.message : String(e)}`
      }
    }
    stats.users = `${accountsCreated}/${merged.size} konton skapade`

    return { stats, generatedPasswords }
  },
})

function cryptoRandomPassword(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
