import { query } from './_generated/server'
import { requireAdmin } from './lib/permissions'
import type { Doc } from './_generated/dataModel'

// Aggregerar allt notifications.tsx tidigare hämtade med 10 separata
// supabase.from(...)-anrop (meddelanden, vittnesmål, 8 utkastkällor) till EN
// Convex-query — konsumerad via en enda useQuery i den omskrivna
// notifications.tsx, med riktig push-reaktivitet istället för manuell
// tick/refresh(). Se MIGRATION_PLAN.md §4.
//
// intranetNotifications.tsx (separat, bara intranätets egna fyra källor)
// rörs INTE — den går kvar via den generiska shimmen, se §4.

const RECENT_LIMIT = 30
const DRAFT_STATUSES = new Set(['draft', 'review'])

const DRAFT_SOURCES = [
  { table: 'posts', label: 'Nyhet', titleField: 'title' },
  { table: 'topics', label: 'Ämne', titleField: 'title' },
  { table: 'documents', label: 'Dokument', titleField: 'title' },
  { table: 'mediaItems', label: 'Media', titleField: 'title' },
  { table: 'timelineEvents', label: 'Tidslinje', titleField: 'title' },
  { table: 'mapLocations', label: 'Kartpunkt', titleField: 'title' },
  { table: 'mapAreas', label: 'Kartområde', titleField: 'title' },
  { table: 'faqItems', label: 'FAQ', titleField: 'question' },
] as const

const INTRANET_SOURCES = [
  { key: 'notices', table: 'intranetNotices', titleField: 'title', tsField: 'created_at', path: '/internt' },
  { key: 'notes', table: 'intranetNotes', titleField: 'title', tsField: 'updated_at', path: '/internt/anteckningar' },
  { key: 'tasks', table: 'intranetTasks', titleField: 'text', tsField: 'created_at', path: '/internt/uppgifter' },
  { key: 'documents', table: 'internalDocuments', titleField: 'title', tsField: 'created_at', path: '/internt/dokument' },
] as const

interface NotificationItem {
  id: string
  source: string
  title: string
  subtitle: string
  created_at: string
  path: string
  isNew: boolean
}

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAdmin(ctx)
    const seen = user.notifications_seen ?? {}
    const clearedAt = user.notifications_cleared_at ?? null
    const isNew = (source: string, at: string) => {
      const mark = seen[source]
      return !mark || new Date(at).getTime() > new Date(mark).getTime()
    }

    const messages = await ctx.db.query('contactMessages').collect()
    const testimonies = await ctx.db.query('testimonies').collect()

    const list: NotificationItem[] = []

    for (const m of messages.sort(byCreatedDesc).slice(0, RECENT_LIMIT)) {
      list.push({
        id: m._id, source: 'messages',
        title: m.subject?.trim() || 'Meddelande utan ämne',
        subtitle: [m.name, m.email].filter(Boolean).join(' · ') || 'Okänd avsändare',
        created_at: m.created_at, path: '/admin/meddelanden', isNew: isNew('messages', m.created_at),
      })
    }
    for (const t of testimonies.sort(byCreatedDesc).slice(0, RECENT_LIMIT)) {
      const author = t.is_anonymous ? 'Anonym' : (t.author_name || 'Anonym')
      list.push({
        id: t._id, source: 'testimonies',
        title: t.title?.trim() || 'Nytt vittnesmål',
        subtitle: [author, t.location].filter(Boolean).join(' · '),
        created_at: t.created_at, path: '/admin/vittnesmal', isNew: isNew('testimonies', t.created_at),
      })
    }

    let draftTotal = 0
    for (const src of DRAFT_SOURCES) {
      const rows = await ctx.db.query(src.table as 'posts').collect()
      for (const row of rows as unknown as Doc<'posts'>[]) {
        if (!DRAFT_STATUSES.has(row.status)) continue
        draftTotal++
        const r = row as unknown as Record<string, unknown>
        list.push({
          id: row._id, source: 'drafts',
          title: (String(r[src.titleField] ?? '')).trim() || '(utan titel)',
          subtitle: src.label,
          created_at: row.updated_at, path: '/admin/utkast', isNew: isNew('drafts', row.updated_at),
        })
      }
    }

    for (const src of INTRANET_SOURCES) {
      const rows = await ctx.db.query(src.table as 'intranetNotices').collect()
      for (const row of rows as unknown[] as Record<string, unknown>[]) {
        const at = String(row[src.tsField])
        list.push({
          id: row._id as string, source: src.key,
          title: (String(row[src.titleField] ?? '')).trim() || '(utan titel)',
          subtitle: src.key, created_at: at, path: src.path, isNew: isNew(src.key, at),
        })
      }
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return { items: list, draftTotal, seen, clearedAt }
  },
})

function byCreatedDesc(a: { created_at: string }, b: { created_at: string }): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}
