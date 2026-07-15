import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { pageBySlug } from './pages'

// Reads a page's editable texts from the `pages` collection, falling back to
// the defaults defined in pages.ts. `text(key)` resolves the extra per-page
// fields (form labels etc.).
export function usePage(slug: string) {
  const cfg = pageBySlug(slug)
  const [data, setData] = useState<{ title?: string; intro?: string; texts?: Record<string, string> } | null>(null)

  useEffect(() => {
    let active = true
    supabase.from('pages').select('*').eq('slug', slug).maybeSingle().then(({ data }) => {
      if (active) setData(data as { title?: string; intro?: string; texts?: Record<string, string> } | null)
    })
    return () => { active = false }
  }, [slug])

  const texts = data?.texts ?? {}

  return {
    title: data?.title || cfg?.defaultTitle || '',
    intro: (data?.intro ?? cfg?.defaultIntro) || '',
    text: (key: string) => texts[key] || cfg?.fields?.find(f => f.key === key)?.default || '',
  }
}
