import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import type { UserRole } from '../../lib/types'
import { roleLabel } from '../../lib/utils'

const MENU_ITEMS: { label: string; path: string; roles: UserRole[] }[] = [
  { label: 'Översikt', path: '/admin', roles: ['superadmin', 'redaktor', 'skribent'] },
  { label: 'Nyheter', path: '/admin/nyheter', roles: ['superadmin', 'redaktor', 'skribent'] },
  { label: 'Ämnesområden', path: '/admin/amnen', roles: ['superadmin', 'redaktor', 'skribent'] },
  { label: 'Vittnesmål', path: '/admin/vittnesmal', roles: ['superadmin', 'redaktor'] },
  { label: 'Dokument', path: '/admin/dokument', roles: ['superadmin', 'redaktor', 'skribent'] },
  { label: 'Media', path: '/admin/media', roles: ['superadmin', 'redaktor', 'skribent'] },
  { label: 'Karta', path: '/admin/karta', roles: ['superadmin', 'redaktor'] },
  { label: 'Tidslinje', path: '/admin/tidslinje', roles: ['superadmin', 'redaktor'] },
  { label: 'FAQ', path: '/admin/faq', roles: ['superadmin', 'redaktor'] },
  { label: 'Kontakter', path: '/admin/kontakter', roles: ['superadmin', 'redaktor'] },
  { label: 'Meny', path: '/admin/meny', roles: ['superadmin', 'redaktor'] },
  { label: 'Formulärmeddelanden', path: '/admin/meddelanden', roles: ['superadmin', 'redaktor'] },
  { label: 'Bakgrundssidan', path: '/admin/bakgrund', roles: ['superadmin', 'redaktor'] },
  { label: 'Webbplatsinställningar', path: '/admin/inställningar', roles: ['superadmin'] },
  { label: 'Administratörer', path: '/admin/administratörer', roles: ['superadmin'] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visibleItems = MENU_ITEMS.filter(item => role && item.roles.includes(role))

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
          {visibleItems.map(item => {
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
