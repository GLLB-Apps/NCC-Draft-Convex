import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { SiteSettings, NavigationItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import NavIcon from './NavIcon'

export default function Header({ settings }: { settings: SiteSettings | null }) {
  const [navItems, setNavItems] = useState<NavigationItem[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    supabase
      .from('navigation_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setNavItems(data ?? []))
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const topLevel = navItems.filter(i => !i.parent_id)
  const childrenOf = (id: string) => navItems.filter(i => i.parent_id === id)

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close on Escape.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
    <header className="site-header">
      {settings?.status_message && (
        <div className="status-bar">
          <div className="container">
            <span className="status-bar-text">{settings.status_message}</span>
          </div>
        </div>
      )}
      <div className="container header-inner">
        <Link to="/" className="site-logo" aria-label={settings?.site_name ?? 'Rögleskogen'}>
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={settings.site_name} className="logo-img" />
          ) : (
            <span className="logo-text">
              <span className="logo-name">{settings?.site_name ?? 'Rögleskogen'}</span>
              <span className="logo-subtitle">{settings?.site_subtitle}</span>
            </span>
          )}
        </Link>

        <nav className="main-nav" aria-label="Huvudmeny">
          {topLevel.map(item => {
            const children = childrenOf(item.id)
            if (children.length === 0) {
              return item.url ? (
                <Link
                  key={item.id}
                  to={item.url}
                  className={location.pathname === item.url ? 'nav-link active' : 'nav-link'}
                >
                  <NavIcon path={item.url} />{item.label}
                </Link>
              ) : null
            }
            const groupActive = children.some(c => c.url === location.pathname)
            return (
              <div className="nav-group" key={item.id}>
                {item.url ? (
                  <Link to={item.url} className={groupActive ? 'nav-link nav-group-trigger active' : 'nav-link nav-group-trigger'}>
                    {item.label}<span className="nav-caret" aria-hidden="true">▾</span>
                  </Link>
                ) : (
                  <button type="button" className={groupActive ? 'nav-link nav-group-trigger active' : 'nav-link nav-group-trigger'} aria-haspopup="true">
                    {item.label}<span className="nav-caret" aria-hidden="true">▾</span>
                  </button>
                )}
                <div className="nav-dropdown">
                  {children.map(c => (
                    <Link
                      key={c.id}
                      to={c.url}
                      className={location.pathname === c.url ? 'nav-dropdown-link active' : 'nav-dropdown-link'}
                    >
                      <NavIcon path={c.url} />{c.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="header-actions">
          <a
            href={settings?.petition_url ?? '#'}
            className="btn btn-primary btn-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Skriv under
          </a>
          <button
            className={mobileOpen ? 'mobile-toggle open' : 'mobile-toggle'}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Stäng meny' : 'Öppna meny'}
            aria-expanded={mobileOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>

      <div
        className={mobileOpen ? 'mobile-nav-backdrop open' : 'mobile-nav-backdrop'}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <nav
        className={mobileOpen ? 'mobile-nav open' : 'mobile-nav'}
        aria-label="Mobilmeny"
        aria-hidden={!mobileOpen}
      >
        <ul className="mobile-nav-list">
          {topLevel.map((item, i) => {
            const children = childrenOf(item.id)
            return (
              <li key={item.id} style={{ '--i': String(i) } as CSSProperties}>
                {item.url ? (
                  <Link
                    to={item.url}
                    className={location.pathname === item.url ? 'mobile-nav-link active' : 'mobile-nav-link'}
                    tabIndex={mobileOpen ? 0 : -1}
                  >
                    <span className="mobile-nav-link-icon"><NavIcon path={item.url} /></span>
                    <span className="mobile-nav-link-label">{item.label}</span>
                    <span className="mobile-nav-link-arrow" aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <div className="mobile-nav-grouplabel">{item.label}</div>
                )}
                {children.length > 0 && (
                  <ul className="mobile-nav-sublist">
                    {children.map(c => (
                      <li key={c.id}>
                        <Link
                          to={c.url}
                          className={location.pathname === c.url ? 'mobile-nav-link mobile-nav-sublink active' : 'mobile-nav-link mobile-nav-sublink'}
                          tabIndex={mobileOpen ? 0 : -1}
                        >
                          <span className="mobile-nav-link-icon"><NavIcon path={c.url} /></span>
                          <span className="mobile-nav-link-label">{c.label}</span>
                          <span className="mobile-nav-link-arrow" aria-hidden="true">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        <a
          href={settings?.petition_url ?? '#'}
          className="btn btn-primary mobile-nav-cta"
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={mobileOpen ? 0 : -1}
        >
          Skriv under
        </a>
      </nav>
    </>
  )
}
