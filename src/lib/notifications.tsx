// Notiser för adminpanelen: allt som kommit in utifrån sedan användaren senast
// läste sina notiser. Delas av klockan i topbaren och badgarna i Översikt.
//
// Native Convex-hook (useQuery), inte den generiska shimmen — ersätter de
// tidigare 10 separata supabase.from(...)-anropen + manuell tick/refresh()
// med EN reaktiv serverfunktion (convex/notifications.ts: listForCurrentUser)
// som uppdaterar sig själv push-baserat. Se MIGRATION_PLAN.md §4.
import React, { createContext, useContext, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from './auth'
import type { IntranetSource } from './intranetSources'

export type NotificationSource = 'messages' | 'testimonies' | 'drafts' | IntranetSource

export interface NotificationSourceMeta {
  label: string
  path: string
}

export const NOTIFICATION_SOURCES: Record<NotificationSource, NotificationSourceMeta> = {
  messages: { label: 'Meddelande', path: '/admin/meddelanden' },
  testimonies: { label: 'Vittnesmål', path: '/admin/vittnesmal' },
  drafts: { label: 'Utkast', path: '/admin/utkast' },
  notices: { label: 'Anslag', path: '/internt' },
  notes: { label: 'Anteckning', path: '/internt/anteckningar' },
  tasks: { label: 'Uppgift', path: '/internt/uppgifter' },
  documents: { label: 'Dokument', path: '/internt/dokument' },
}

export interface NotificationItem {
  id: string
  source: NotificationSource
  title: string
  subtitle: string
  created_at: string
  path: string
  isNew: boolean
}

interface NotificationsValue {
  items: NotificationItem[]
  newCount: number
  newBySource: Record<NotificationSource, number>
  draftTotal: number
  loading: boolean
  error: string | null
  clearableCount: number
  markAllRead: () => Promise<void>
  markSourceRead: (source: NotificationSource) => Promise<void>
  clearRead: () => Promise<void>
  refresh: () => void
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const result = useQuery(api.notifications.listForCurrentUser, user ? {} : 'skip')
  const updateProfile = useMutation(api.users.updateProfile)

  const items = (result?.items ?? []) as NotificationItem[]
  const draftTotal = result?.draftTotal ?? 0
  const seen = result?.seen ?? {}
  const clearedAt = result?.clearedAt ?? null
  const loading = user !== null && result === undefined
  // useQuery saknar ett manuellt "refresh" — Convex uppdaterar reaktivt när
  // underliggande data ändras. Kvar av API-kompatibilitet (se useMarkSourceRead
  // nedan som inte bryr sig om den gör något).
  const refresh = useCallback(() => {}, [])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    const all = Object.keys(NOTIFICATION_SOURCES)
    await updateProfile({ notifications_seen: { ...seen, ...Object.fromEntries(all.map(s => [s, now])) } })
  }, [updateProfile, seen])

  const markSourceRead = useCallback(async (source: NotificationSource) => {
    const now = new Date().toISOString()
    await updateProfile({ notifications_seen: { ...seen, [source]: now } })
  }, [updateProfile, seen])

  const clearRead = useCallback(async () => {
    await updateProfile({ notifications_cleared_at: new Date().toISOString() })
  }, [updateProfile])

  const isCleared = (i: NotificationItem) =>
    !i.isNew && clearedAt != null && new Date(i.created_at).getTime() <= new Date(clearedAt).getTime()

  const visibleItems = items.filter(i => !isCleared(i))
  const clearableCount = visibleItems.filter(i => !i.isNew).length

  const newBySource = { messages: 0, testimonies: 0, drafts: 0, notices: 0, notes: 0, tasks: 0, documents: 0 } as Record<NotificationSource, number>
  for (const i of visibleItems) if (i.isNew) newBySource[i.source]++
  const newCount = (Object.values(newBySource) as number[]).reduce((a, b) => a + b, 0)

  return (
    <NotificationsContext.Provider value={{
      items: visibleItems, newCount, newBySource, draftTotal,
      loading, error: null, clearableCount, markAllRead, markSourceRead, clearRead, refresh,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}

/**
 * Markerar en notiskälla som läst när användaren faktiskt stannat kvar på dess
 * sida en stund — inte redan vid menyklicket.
 */
export function useMarkSourceRead(source: NotificationSource, ready = true, delayMs = 2000) {
  const { markSourceRead, newBySource } = useNotifications()
  const pending = newBySource[source]

  useEffect(() => {
    if (!ready || pending === 0) return
    const timer = setTimeout(() => { void markSourceRead(source) }, delayMs)
    return () => clearTimeout(timer)
  }, [ready, pending, source, delayMs, markSourceRead])
}

/** Kortare relativ tid på svenska, t.ex. "3 tim sedan". */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(diff)) return ''
  const min = Math.round(diff / 60000)
  if (min < 1) return 'nyss'
  if (min < 60) return `${min} min sedan`
  const hrs = Math.round(min / 60)
  if (hrs < 24) return `${hrs} tim sedan`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} d sedan`
  return new Date(iso).toLocaleDateString('sv-SE')
}
