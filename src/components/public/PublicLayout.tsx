import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'
import VoteWidget from './VoteWidget'
import type { SiteSettings } from '../../lib/types'
import { supabase } from '../../lib/supabase'

export default function PublicLayout() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const isHome = useLocation().pathname === '/'

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('*')
      .maybeSingle()
      .then(({ data }) => setSettings(data as SiteSettings | null))
  }, [])

  return (
    <div className="public-layout">
      <Header settings={settings} />
      {/* On the start page the widget lives inline beside the summary section instead */}
      {!isHome && <VoteWidget settings={settings} />}
      <main className="public-main">
        <Outlet context={{ settings }} />
      </main>
      <Footer settings={settings} />
    </div>
  )
}
