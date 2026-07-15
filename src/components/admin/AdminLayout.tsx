import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import type { UserRole } from '../../lib/types'
import { roleLabel } from '../../lib/utils'
import { PAGES } from '../../lib/pages'

type MenuItem = { label: string; path: string; roles: UserRole[] }
const MENU_GROUPS: { title: string | null; items: MenuItem[] }[] = [
  {
    title: null,
    items: [{ label: 'Översikt', path: '/admin', roles: ['superadmin', 'redaktor', 'skribent'] }],
  },
  {
    title: 'Innehåll',
    items: [
      { label: 'Sidor', path: '/admin/sidor', roles: ['superadmin', 'redaktor'] },
      { label: 'Nyheter', path: '/admin/nyheter', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Ämnesområden', path: '/admin/amnen', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Dokument', path: '/admin/dokument', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Media', path: '/admin/media', roles: ['superadmin', 'redaktor', 'skribent'] },
      { label: 'Karta', path: '/admin/karta', roles: ['superadmin', 'redaktor'] },
      { label: 'Tidslinje', path: '/admin/tidslinje', roles: ['superadmin', 'redaktor'] },
      { label: 'FAQ', path: '/admin/faq', roles: ['superadmin', 'redaktor'] },
      { label: 'Bakgrundssidan', path: '/admin/bakgrund', roles: ['superadmin', 'redaktor'] },
    ],
  },
  {
    title: 'Kommunikation',
    items: [
      { label: 'Vittnesmål', path: '/admin/vittnesmal', roles: ['superadmin', 'redaktor'] },
      { label: 'Meddelanden', path: '/admin/meddelanden', roles: ['superadmin', 'redaktor'] },
      { label: 'Kontakter', path: '/admin/kontakter', roles: ['superadmin', 'redaktor'] },
    ],
  },
  {
    title: 'Webbplats',
    items: [
      { label: 'Meny', path: '/admin/meny', roles: ['superadmin', 'redaktor'] },
      { label: 'Inställningar', path: '/admin/inställningar', roles: ['superadmin'] },
      { label: 'Administratörer', path: '/admin/administratörer', roles: ['superadmin'] },
    ],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [query, setQuery] = useState('')

  const destinations = useMemo(() => {
    const items: { label: string; path: string }[] = []
    for (const group of MENU_GROUPS) {
      for (const item of group.items) {
        if (role && item.roles.includes(role)) items.push({ label: item.label, path: item.path })
      }
    }
    for (const p of PAGES) items.push({ label: `Sida · ${p.label}`, path: `/admin/sidor/${p.slug}` })
    return items
  }, [role])

  const q = query.trim().toLowerCase()
  const results = q ? destinations.filter(d => d.label.toLowerCase().includes(q)).slice(0, 8) : []
  function go(path: string) { setQuery(''); navigate(path) }

  const breadcrumbs = location.pathname
    .split('/')
    .filter(Boolean)
    .map(seg => decodeURIComponent(seg))

  async function handleSignOut() {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <div className="admin-layout">
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <Link to="/admin" className="admin-logo">Rögleskogen</Link>
          <span className="admin-badge">Admin</span>
        </div>
        <nav className="admin-menu" aria-label="Adminmeny">
          {MENU_GROUPS.map((group, gi) => {
            const items = group.items.filter(item => role && item.roles.includes(role))
            if (items.length === 0) return null
            return (
              <div className="admin-menu-group" key={gi}>
                {group.title && <div className="admin-menu-group-title">{group.title}</div>}
                {items.map(item => {
                  const isActive = item.path === '/admin'
                    ? location.pathname === '/admin'
                    : location.pathname.startsWith(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={isActive ? 'admin-menu-link active' : 'admin-menu-link'}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-menu-link" target="_blank">Visa webbplats →</Link>
        </div>
      </aside>

      {sidebarOpen && <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Visa/dölj meny"
          >
            ☰
          </button>

          <div className="admin-search">
            <input
              className="admin-search-input"
              type="text"
              placeholder="Sök – hoppa till valfri sida eller sektion…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && results[0]) go(results[0].path)
                if (e.key === 'Escape') setQuery('')
              }}
              aria-label="Sök i adminpanelen"
            />
            {results.length > 0 && (
              <div className="admin-search-results">
                {results.map(r => (
                  <button
                    key={r.path}
                    type="button"
                    className="admin-search-result"
                    onMouseDown={e => { e.preventDefault(); go(r.path) }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <nav className="admin-breadcrumbs" aria-label="Brödsmulor">
            <Link to="/admin">Admin</Link>
            {breadcrumbs.slice(1).map((seg, i) => (
              <span key={i}>
                <span className="admin-breadcrumb-sep">/</span>
                <span>{seg}</span>
              </span>
            ))}
          </nav>
          <div className="admin-user-menu">
            <span className="admin-user-name">
              {user?.email}
              {role && <span className="badge badge-muted" style={{ marginLeft: 'var(--space-2)' }}>{roleLabel(role)}</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Logga ut</button>
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  )
}
