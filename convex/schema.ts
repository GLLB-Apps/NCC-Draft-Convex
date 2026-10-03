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

export default defineSchema({
  ...authTables,

  // Convex Auths egen `users`-tabell utökad med precis de fält som i PHP-
  // versionen slogs ihop från Appwrites account+label+user_roles+profiles+
  // intranet_members till EN rad (se UserCollections.php) — här utan någon
  // SQL-vynivå, bara fält direkt på dokumentet.
  users: defineTable({
    email: v.string(),
    role: v.optional(v.union(v.literal('superadmin'), v.literal('redaktor'), v.literal('skribent'))),
    intranet_member: v.optional(v.boolean()),
    intranet_read_only: v.optional(v.boolean()),
    display_name: v.optional(v.string()),
    intro: v.optional(v.string()),
    notifications_seen: v.optional(v.record(v.string(), v.string())),
    notifications_cleared_at: v.optional(v.string()),
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
    used_at: v.optional(v.string()),
  }).index('token_hash', ['token_hash']).index('user_id', ['user_id']),

  // --- Alltid publikt läsbara, admin skriver -------------------------------
  siteSettings: defineTable(v.any()), // singleton-dokument, fritt formade fält (se SiteSettings i types.ts)
  pages: defineTable({
    slug: v.string(),
    title: v.optional(v.string()),
    intro: v.optional(v.string()),
    texts: v.optional(v.record(v.string(), v.string())),
    blocks: v.optional(contentBlocks),
    created_at: v.string(),
    updated_at: v.string(),
  }).index('slug', ['slug']),
  navigationItems: defineTable({
    label: v.string(),
    url: v.string(),
    icon: v.optional(v.string()),
    sort_order: v.number(),
    is_active: v.boolean(),
    parent_id: v.optional(v.string()),
  }),
  faqCategories: defineTable({
    name: v.string(),
    slug: v.string(),
    sort_order: v.number(),
  }),
  contacts: defineTable({
    name: v.string(),
    role: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    is_public: v.boolean(),
    sort_order: v.number(),
  }),
  customIcons: defineTable({
    name: v.string(),
    label: v.optional(v.string()),
    added_by: v.optional(v.string()),
    created_at: v.string(),
  }),
  changelogEntries: defineTable({
    title: v.string(),
    body: v.optional(v.string()),
    entry_date: v.optional(v.string()),
    category: v.optional(v.union(v.literal('feature'), v.literal('improvement'), v.literal('fix'), v.literal('other'))),
    version: v.optional(v.string()),
    commit_sha: v.optional(v.string()),
    created_by: v.optional(v.string()),
    created_by_name: v.optional(v.string()),
    created_at: v.string(),
    updated_at: v.string(),
  }),
  sponsors: defineTable({
    name: v.string(),
    image_url: v.optional(v.string()),
    link_url: v.optional(v.string()),
    sort_order: v.number(),
    is_active: v.boolean(),
    created_at: v.string(),
    updated_at: v.string(),
  }),

  // --- Status-grindade (publikt läsbara bara när published) ---------------
  topics: defineTable({
    title: v.string(), slug: v.string(), intro: v.optional(v.string()),
    content: contentBlocks, status,
    featured_image: v.optional(v.string()), icon: v.optional(v.string()), sort_order: v.number(),
    created_by: v.optional(v.string()), updated_by: v.optional(v.string()),
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('slug', ['slug']).index('status', ['status']),
  posts: defineTable({
    title: v.string(), slug: v.string(), excerpt: v.optional(v.string()),
    content: contentBlocks, featured_image: v.optional(v.string()), image_caption: v.optional(v.string()),
    author: v.optional(v.string()), status, is_pinned: v.boolean(),
    category: v.optional(v.string()), tags: v.array(v.string()),
    source: v.optional(v.string()), external_url: v.optional(v.string()),
    seo_title: v.optional(v.string()), seo_description: v.optional(v.string()),
    published_at: v.optional(v.string()), created_by: v.optional(v.string()), updated_by: v.optional(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('slug', ['slug']).index('status', ['status']),
  documents: defineTable({
    title: v.string(), description: v.optional(v.string()),
    file_url: v.optional(v.string()), external_url: v.optional(v.string()),
    document_date: v.optional(v.string()), sender: v.optional(v.string()),
    sender_type: v.optional(v.union(v.literal('ncc'), v.literal('lund_kommun'), v.literal('authority'), v.literal('media'), v.literal('initiative'), v.literal('private'))),
    file_type: v.optional(v.string()), source: v.optional(v.string()), status,
    published_at: v.optional(v.string()), created_by: v.optional(v.string()), updated_by: v.optional(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  mediaItems: defineTable({
    title: v.string(), description: v.optional(v.string()), alt_text: v.optional(v.string()),
    photographer: v.optional(v.string()), media_date: v.optional(v.string()), location: v.optional(v.string()),
    media_type: v.union(v.literal('image'), v.literal('video'), v.literal('map'), v.literal('graphic'), v.literal('press_image')),
    file_url: v.optional(v.string()), video_url: v.optional(v.string()), rights_info: v.optional(v.string()),
    is_press_allowed: v.boolean(), marketing_ok: v.boolean(), status,
    published_at: v.optional(v.string()), created_by: v.optional(v.string()), updated_by: v.optional(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  timelineEvents: defineTable({
    event_date: v.string(), title: v.string(), description: v.optional(v.string()),
    event_type: v.optional(v.string()), link_url: v.optional(v.string()), related_document_id: v.optional(v.string()),
    image_url: v.optional(v.string()), status, sort_order: v.number(),
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  customPages: defineTable({
    slug: v.string(), title: v.string(), intro: v.optional(v.string()),
    blocks: contentBlocks, status, sort_order: v.number(),
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('slug', ['slug']).index('status', ['status']),
  mapLocations: defineTable({
    title: v.string(), description: v.optional(v.string()), lat: v.number(), lng: v.number(),
    point_type: v.union(
      v.literal('work_area'), v.literal('quarry_area'), v.literal('property_border'), v.literal('transport_route'),
      v.literal('residence_distance'), v.literal('nature_value'), v.literal('walking_trail'),
      v.literal('observation_point'), v.literal('photo_point'), v.literal('testimony_point'),
    ),
    icon: v.optional(v.string()), image_url: v.optional(v.string()), source: v.optional(v.string()), status,
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  mapAreas: defineTable({
    title: v.string(), description: v.optional(v.string()), color: v.string(),
    line_style: v.union(v.literal('solid'), v.literal('dashed')), fill_opacity: v.number(),
    icon: v.optional(v.string()), image_url: v.optional(v.string()),
    points: v.array(v.array(v.number())), // LatLngTuple[] ([lat,lng] par)
    sort_order: v.number(), status,
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),

  // --- Status-grindade + publik skapelse -----------------------------------
  faqItems: defineTable({
    question: v.string(), answer: v.string(), category_id: v.optional(v.string()),
    sort_order: v.number(), status,
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),
  testimonies: defineTable({
    title: v.optional(v.string()), story: v.string(),
    author_name: v.optional(v.string()), is_anonymous: v.boolean(),
    location: v.optional(v.string()), area_usage: v.optional(v.string()), featured_image: v.optional(v.string()),
    map_lat: v.optional(v.number()), map_lng: v.optional(v.number()),
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('rejected'), v.literal('archived')),
    consent_publish: v.boolean(), consent_contact: v.boolean(), consent_marketing: v.boolean(),
    published_at: v.optional(v.string()), created_at: v.string(), updated_at: v.string(),
    // email/internal_note medvetet UTESLUTNA — var redan @deprecated i Appwrite-versionen
    // (flyttade till testimonyContacts), och Convex har inga gamla rader att vara bakåtkompatibel med.
  }).index('status', ['status']),

  // --- Admin-läsning enbart + publik skapelse ------------------------------
  testimonyContacts: defineTable({
    testimony_id: v.id('testimonies'),
    email: v.optional(v.string()), author_name: v.optional(v.string()), internal_note: v.optional(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('testimony_id', ['testimony_id']),
  contactMessages: defineTable({
    name: v.string(), email: v.string(), subject: v.optional(v.string()), message: v.string(),
    status: v.union(v.literal('unread'), v.literal('read'), v.literal('handled'), v.literal('archived')),
    internal_note: v.optional(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }).index('status', ['status']),

  // --- Intranät: medlemsläsning, intranät-skrivbehörig skriver -------------
  intranetNotices: defineTable({
    title: v.string(), body: v.optional(v.string()), author: v.optional(v.string()), author_id: v.optional(v.string()),
    pinned: v.boolean(), created_at: v.string(), updated_at: v.string(),
  }),
  intranetNotes: defineTable({
    title: v.string(), body: v.optional(v.string()), category: v.optional(v.string()), pinned: v.boolean(),
    created_by: v.optional(v.string()), created_by_name: v.optional(v.string()), sort_order: v.number(),
    created_at: v.string(), updated_at: v.string(),
  }),
  intranetTasks: defineTable({
    text: v.string(), done: v.boolean(), list: v.optional(v.string()), assignee: v.optional(v.string()),
    due_date: v.optional(v.string()), created_by: v.optional(v.string()), done_by: v.optional(v.string()),
    sort_order: v.number(), created_at: v.string(), updated_at: v.string(),
  }),
  internalDocCategories: defineTable({
    name: v.string(), sort_order: v.number(),
  }),
  internalDocuments: defineTable({
    title: v.string(), description: v.optional(v.string()),
    file_url: v.optional(v.string()), file_name: v.optional(v.string()), file_type: v.optional(v.string()),
    file_size: v.optional(v.number()), category_id: v.optional(v.string()),
    owner: v.optional(v.string()), uploaded_by: v.optional(v.string()), uploaded_by_id: v.optional(v.string()),
    created_at: v.string(), updated_at: v.string(),
  }),

  // --- Admin-läsning enbart, aldrig klient-skrivbar ------------------------
  auditLog: defineTable({
    user_id: v.optional(v.string()), action: v.string(),
    entity_type: v.optional(v.string()), entity_id: v.optional(v.string()),
    details: v.optional(v.any()), created_at: v.string(),
  }).index('created_at', ['created_at']),
})
