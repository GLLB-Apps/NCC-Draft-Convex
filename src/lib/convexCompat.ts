// Tabellnamn (så som ~30 sidor redan anropar dem, t.ex.
// `supabase.from('media_items')`) → genererad Convex-funktionsreferens.
// Det enda stället som behöver hårdkodas manuellt, eftersom Convex-funktioner
// är statiskt namngivna (api.mediaItems.list) och inte går att slå upp
// dynamiskt med typkontroll — se MIGRATION_PLAN.md §1/§4.
//
// `user_roles`/`intranet_members`/`profiles` finns MEDVETET INTE här: de två
// första användes bara av AdminAdmins.tsx (skrivs om att anropa
// convex/users.ts direkt), och `profiles` hanteras som specialfall i
// supabase.ts (se users.ts: getProfile/setPendingProfile/updateProfile).
import { api } from '../../convex/_generated/api'

// Löst typad med avsikt: detta är en ren plumbing-tabell, den faktiska
// typkontrollen sker i varje convex/*.ts-fil.
export type TableApi = Record<string, any>

export const TABLE_API: Record<string, TableApi> = {
  site_settings: api.siteSettings as unknown as TableApi,
  pages: api.pages as unknown as TableApi, // create saknas med avsikt — se "pages"-specialfallet i supabase.ts (upsert via slug)
  navigation_items: api.navigationItems as unknown as TableApi,
  faq_categories: api.faqCategories as unknown as TableApi,
  contacts: api.contacts as unknown as TableApi,
  custom_icons: api.customIcons as unknown as TableApi,
  changelog_entries: api.changelogEntries as unknown as TableApi,
  sponsors: api.sponsors as unknown as TableApi,
  topics: api.topics as unknown as TableApi,
  posts: api.posts as unknown as TableApi,
  documents: api.documents as unknown as TableApi,
  media_items: api.mediaItems as unknown as TableApi,
  timeline_events: api.timelineEvents as unknown as TableApi,
  custom_pages: api.customPages as unknown as TableApi,
  map_locations: api.mapLocations as unknown as TableApi,
  map_areas: api.mapAreas as unknown as TableApi,
  faq_items: api.faqItems as unknown as TableApi,
  testimonies: api.testimonies as unknown as TableApi,
  testimony_contacts: api.testimonyContacts as unknown as TableApi,
  contact_messages: api.contactMessages as unknown as TableApi, // create saknas med avsikt — publik skapelse går via contact.ts: submit (action)
  intranet_notices: api.intranetNotices as unknown as TableApi,
  intranet_notes: api.intranetNotes as unknown as TableApi,
  intranet_tasks: api.intranetTasks as unknown as TableApi,
  internal_doc_categories: api.internalDocCategories as unknown as TableApi,
  internal_documents: api.internalDocuments as unknown as TableApi,
  audit_log: api.auditLog as unknown as TableApi, // create/update/remove saknas med avsikt — aldrig klient-skrivbar
}
