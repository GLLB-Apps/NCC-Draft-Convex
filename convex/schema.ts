import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

// Innehållsblock (rika textblock i topics/posts/pages/customPages) lagras
// oschemalagt, precis som i Appwrite (ingen server-side validering där
// heller) — se MIGRATION_PLAN.md §2 för varför v.any() är paritet, inte en
// regression. TypeScript-säkerheten på applikationsnivå kommer från
// src/lib/types.ts ContentBlock/LayoutColumn, oförändrat.
const contentBlocks = v.array(v.any())

const status = v.union(v.literal('draft'), v.literal('review'), v.literal('published'), v.literal('archived'))

// v.optional(x) betyder bara att FÄLTET FÅR SAKNAS — inte att det får vara
// null. Hela React-adminpanelen (oförändrad sen Appwrite/Supabase-eran)
// skickar genomgående null för tomma valfria fält (src/lib/supabase.ts:
// toData() behåller null med avsikt, eftersom en update/patch MÅSTE kunna
// nollställa ett fält explicit — att bara utelämna nyckeln vid en patch
// lämnar det gamla värdet orört). Upptäckt i produktion (posts.author: null
// floppade mot v.string()) — fixat generellt här istället för fält för fält,
// eftersom samma mönster finns på i princip varje valfritt fält i appen.
function opt<T extends import('convex/values').Validator<any, any, any>>(x: T) {
  return v.optional(v.union(x, v.null()))
}

export default defineSchema({
  ...authTables,

  // Convex Auths egen `users`-tabell utökad med precis de fält som i PHP-
  // versionen slogs ihop från Appwrites account+label+user_roles+profiles+
  // intranet_members till EN rad (se UserCollections.php) — här utan någon
  // SQL-vynivå, bara fält direkt på dokumentet.
  users: defineTable({
    email: v.string(),
    role: opt(v.union(v.literal('superadmin'), v.literal('redaktor'), v.literal('skribent'))),
    intranet_member: opt(v.boolean()),
    intranet_read_only: opt(v.boolean()),
    display_name: opt(v.string()),
    intro: opt(v.string()),
    notifications_seen: opt(v.record(v.string(), v.string())),
    notifications_cleared_at: opt(v.string()),
  }).index('email', ['email']),

  // Egen tokendesign för lösenordsåterställning — porterad rakt av från
  // server/lib/Auth.php (SHA-256-hash lagras, aldrig den riktiga token).
  // Används i stället för Convex Auths inbyggda återställningsflöde eftersom
  // AdminResetPassword.tsx förväntar sig exakt denna token-i-länk-form.
  passwordResets: defineTable({
    token_hash: v.string(),
    user_id: v.id('users'),
    created_at: v.string(),
    expires_at: v.string(),
    used_at: opt(v.string()),
  }).index('token_hash', ['token_hash']).index('user_id', ['user_id']),

  // --- Alltid publikt läsbara, admin skriver -------------------------------
  siteSettings: defineTable(v.any()), // singleton-dokument, fritt formade fält (se SiteSettings i types.ts)
  pages: defineTable({
    slug: v.string(),
    title: opt(v.string()),
    intro: opt(v.string()),
    texts: opt(v.record(v.string(), v.string())),
    blocks: opt(contentBlocks),
    created_at: v.string(),
    updated_at: v.string(),
  }).index('slug', ['slug']),
  navigationItems: defineTable({
    label: v.string(),
    url: v.string(),
    icon: opt(v.string()),
    sort_order: v.number(),
    is_active: v.boolean(),
    parent_id: opt(v.string()),
  }),
  faqCategories: defineTable({
    name: v.string(),
    slug: v.string(),
    sort_order: v.number(),
  }),
  contacts: defineTable({
    name: v.string(),
    role: opt(v.string()),
    email: opt(v.string()),
    phone: opt(v.string()),
    is_public: v.boolean(),
    sort_order: v.number(),
  }),
  customIcons: defineTable({
    name: v.string(),
    label: opt(v.string()),
    added_by: opt(v.string()),
    created_at: v.string(),
  }),
  changelogEntries: defineTable({
    title: v.string(),
    body: opt(v.string()),
    entry_date: opt(v.string()),
    category: opt(v.union(v.literal('feature'), v.literal('improvement'), v.literal('fix'), v.literal('other'))),
    version: opt(v.string()),
    commit_sha: opt(v.string()),
    created_by: opt(v.string()),
    created_by_name: opt(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  }),
  sponsors: defineTable({
    name: v.string(),
    image_url: opt(v.string()),
    link_url: opt(v.string()),
    sort_order: v.number(),
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  }),

  // --- Status-grindade (publikt läsbara bara när published) ---------------
  topics: defineTable({
    title: v.string(), slug: v.string(), intro: opt(v.string()),
    content: contentBlocks, status,
    featured_image: opt(v.string()), icon: opt(v.string()), sort_order: v.number(),
    created_by: opt(v.string()), updated_by: opt(v.string()),
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('slug', ['slug']).index('status', ['status']),
  posts: defineTable({
    title: v.string(), slug: v.string(), excerpt: opt(v.string()),
    content: contentBlocks, featured_image: opt(v.string()), image_caption: opt(v.string()),
    author: opt(v.string()), status, is_pinned: v.boolean(),
    category: opt(v.string()), tags: v.array(v.string()),
    source: opt(v.string()), external_url: opt(v.string()),
    seo_title: opt(v.string()), seo_description: opt(v.string()),
    published_at: opt(v.string()), created_by: opt(v.string()), updated_by: opt(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('slug', ['slug']).index('status', ['status']),
  documents: defineTable({
    title: v.string(), description: opt(v.string()),
    file_url: opt(v.string()), external_url: opt(v.string()),
    document_date: opt(v.string()), sender: opt(v.string()),
    sender_type: opt(v.union(v.literal('ncc'), v.literal('lund_kommun'), v.literal('authority'), v.literal('media'), v.literal('initiative'), v.literal('private'))),
    file_type: opt(v.string()), source: opt(v.string()), status,
    published_at: opt(v.string()), created_by: opt(v.string()), updated_by: opt(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  mediaItems: defineTable({
    title: v.string(), description: opt(v.string()), alt_text: opt(v.string()),
    photographer: opt(v.string()), media_date: opt(v.string()), location: opt(v.string()),
    media_type: v.union(v.literal('image'), v.literal('video'), v.literal('map'), v.literal('graphic'), v.literal('press_image')),
    file_url: opt(v.string()), video_url: opt(v.string()), rights_info: opt(v.string()),
    is_press_allowed: v.boolean(), marketing_ok: v.boolean(), status,
    published_at: opt(v.string()), created_by: opt(v.string()), updated_by: opt(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  timelineEvents: defineTable({
    event_date: v.string(), title: v.string(), description: opt(v.string()),
    event_type: opt(v.string()), link_url: opt(v.string()), related_document_id: opt(v.string()),
    image_url: opt(v.string()), status, sort_order: v.number(),
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  customPages: defineTable({
    slug: v.string(), title: v.string(), intro: opt(v.string()),
    blocks: contentBlocks, status, sort_order: v.number(),
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('slug', ['slug']).index('status', ['status']),
  mapLocations: defineTable({
    title: v.string(), description: opt(v.string()), lat: v.number(), lng: v.number(),
    point_type: v.union(
      v.literal('work_area'), v.literal('quarry_area'), v.literal('property_border'), v.literal('transport_route'),
      v.literal('residence_distance'), v.literal('nature_value'), v.literal('walking_trail'),
      v.literal('observation_point'), v.literal('photo_point'), v.literal('testimony_point'),
    ),
    icon: opt(v.string()), image_url: opt(v.string()), source: opt(v.string()), status,
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  mapAreas: defineTable({
    title: v.string(), description: opt(v.string()), color: v.string(),
    line_style: v.union(v.literal('solid'), v.literal('dashed')), fill_opacity: v.number(),
    icon: opt(v.string()), image_url: opt(v.string()),
    points: v.array(v.array(v.number())), // LatLngTuple[] ([lat,lng] par)
    sort_order: v.number(), status,
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),

  // --- Status-grindade + publik skapelse -----------------------------------
  faqItems: defineTable({
    question: v.string(), answer: v.string(), category_id: opt(v.string()),
    sort_order: v.number(), status,
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  testimonies: defineTable({
    title: opt(v.string()), story: v.string(),
    author_name: opt(v.string()), is_anonymous: v.boolean(),
    location: opt(v.string()), area_usage: opt(v.string()), featured_image: opt(v.string()),
    map_lat: opt(v.number()), map_lng: opt(v.number()),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'), v.literal('archived')),
    consent_publish: v.boolean(), consent_contact: v.boolean(), consent_marketing: v.boolean(),
    published_at: opt(v.string()), created_at: v.string(), updated_at: v.string(),
    // email/internal_note medvetet UTESLUTNA — var redan @deprecated i Appwrite-versionen
    // (flyttade till testimonyContacts), och Convex har inga gamla rader att vara bakåtkompatibel med.
  }).index('status', ['status']),

  // --- Admin-läsning enbart + publik skapelse ------------------------------
  testimonyContacts: defineTable({
    testimony_id: v.id('testimonies'),
    email: opt(v.string()), author_name: opt(v.string()), internal_note: opt(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('testimony_id', ['testimony_id']),
  contactMessages: defineTable({
    name: v.string(), email: v.string(), subject: opt(v.string()), message: v.string(),
    status: v.union(v.literal('unread'), v.literal('read'), v.literal('handled'), v.literal('archived')),
    internal_note: opt(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),

  // --- Intranät: medlemsläsning, intranät-skrivbehörig skriver -------------
  intranetNotices: defineTable({
    title: v.string(), body: opt(v.string()), author: opt(v.string()), author_id: opt(v.string()),
    pinned: v.boolean(), created_at: v.string(), updated_at: v.string(),
  }),
  intranetNotes: defineTable({
    title: v.string(), body: opt(v.string()), category: opt(v.string()), pinned: v.boolean(),
    created_by: opt(v.string()), created_by_name: opt(v.string()), sort_order: v.number(),
    created_at: v.string(), updated_at: v.string(),
  }),
  intranetTasks: defineTable({
    text: v.string(), done: v.boolean(), list: opt(v.string()), assignee: opt(v.string()),
    due_date: opt(v.string()), created_by: opt(v.string()), done_by: opt(v.string()),
    sort_order: v.number(), created_at: v.string(), updated_at: v.string(),
  }),
  internalDocCategories: defineTable({
    name: v.string(), sort_order: v.number(),
  }),
  internalDocuments: defineTable({
    title: v.string(), description: opt(v.string()),
    file_url: opt(v.string()), file_name: opt(v.string()), file_type: opt(v.string()),
    file_size: opt(v.number()), category_id: opt(v.string()),
    owner: opt(v.string()), uploaded_by: opt(v.string()), uploaded_by_id: opt(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }),

  // --- Admin-läsning enbart, aldrig klient-skrivbar ------------------------
  auditLog: defineTable({
    user_id: opt(v.string()), action: v.string(),
    entity_type: opt(v.string()), entity_id: opt(v.string()),
    details: opt(v.any()), created_at: v.string(),
  }).index('created_at', ['created_at']),
})
