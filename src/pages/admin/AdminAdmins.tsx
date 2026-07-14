import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { roleLabel } from '../../lib/utils'
import type { UserRole } from '../../lib/types'

interface AdminUser {
  user_id: string
  role: UserRole
  display_name: string | null
  created_at: string
}

interface PendingUser {
  id: string
  display_name: string | null
  created_at: string
}

export default function AdminAdmins() {
  const { user: currentUser, role: currentRole } = useAuth()
  const { show } = useToast()
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [rolesRes, profilesRes] = await Promise.all([
      supabase.from('user_roles').select('user_id, role, created_at, profiles(display_name)').order('created_at'),
      supabase.from('profiles').select('id, display_name, created_at').order('created_at'),
    ])

    const roleRows = rolesRes.data ?? []
    const profileRows = profilesRes.data ?? []
    const assignedIds = new Set(roleRows.map((r: Record<string, unknown>) => r.user_id as string))

    const adminList: AdminUser[] = roleRows.map((row: Record<string, unknown>) => ({
      user_id: row.user_id as string,
      role: row.role as UserRole,
      display_name: (row.profiles as Record<string, string | null> | null)?.display_name ?? null,
      created_at: row.created_at as string,
    }))

    const pendingList: PendingUser[] = (profileRows as Array<Record<string, unknown>>)
      .filter(p => !assignedIds.has(p.id as string))
      .map(p => ({ id: p.id as string, display_name: p.display_name as string | null, created_at: p.created_at as string }))

    setAdmins(adminList)
    setPending(pendingList)
    setLoading(false)
  }

  async function assignRole(userId: string, role: UserRole) {
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role })
    if (error) show('Kunde inte tilldela roll: ' + error.message, 'error')
    else { show(`Roll ${roleLabel(role)} tilldelad`, 'success'); load() }
  }

  async function updateRole(userId: string, role: UserRole) {
    const { error } = await supabase.from('user_roles').update({ role }).eq('user_id', userId)
    if (error) show('Kunde inte uppdatera: ' + error.message, 'error')
    else { show('Roll uppdaterad', 'success'); load() }
  }

  async function removeRole(userId: string) {
    if (userId === currentUser?.id) { show('Du kan inte ta bort din egen roll', 'error'); return }
    if (!confirm('Ta bort administratörsrollen? Användaren förlorar all åtkomst.')) return
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Roll borttagen', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Administratörer</h1>
      </div>

      {/* Pending users */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', color: 'var(--warning)' }}>
            Väntar på rolltilldelning ({pending.length})
          </h2>
          <div className="admin-list">
            {pending.map(u => (
              <div key={u.id} className="admin-list-item">
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">{u.display_name ?? 'Namnlös användare'}</div>
                  <div className="admin-list-item-meta">
                    <span className="badge badge-warning">Ingen roll</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.id}</span>
                  </div>
                </div>
                <div className="admin-table-actions">
                  <select
                    className="form-select"
                    style={{ width: 'auto' }}
                    defaultValue=""
                    onChange={e => { if (e.target.value) assignRole(u.id, e.target.value as UserRole) }}
                    aria-label="Tilldela roll"
                  >
                    <option value="" disabled>Tilldela roll…</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="redaktor">Redaktör</option>
                    <option value="skribent">Skribent</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active admins */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>Aktiva administratörer ({admins.length})</h2>

      {admins.length === 0 ? (
        <div className="empty-state"><p>Inga administratörer finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {admins.map(a => (
            <div key={a.user_id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">
                  {a.display_name ?? 'Okänd användare'}
                  {a.user_id === currentUser?.id && (
                    <span className="badge badge-success" style={{ marginLeft: 'var(--space-2)' }}>Du</span>
                  )}
                </div>
                <div className="admin-list-item-meta">
                  <span>{roleLabel(a.role)}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{a.user_id.substring(0, 8)}…</span>
                </div>
              </div>
              <div className="admin-table-actions">
                <select
                  className="form-select"
                  style={{ width: 'auto' }}
                  value={a.role}
                  onChange={e => updateRole(a.user_id, e.target.value as UserRole)}
                  disabled={a.user_id === currentUser?.id && currentRole === 'superadmin'}
                  aria-label="Ändra roll"
                >
                  <option value="superadmin">Superadmin</option>
                  <option value="redaktor">Redaktör</option>
                  <option value="skribent">Skribent</option>
                </select>
                {a.user_id !== currentUser?.id && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeRole(a.user_id)}>Ta bort</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--space-6)', background: 'var(--bg-alt)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          För att lägga till en ny administratör: personen skapar ett konto via{' '}
          <a href="/admin/login" className="section-link">/admin/login</a>, sedan dyker de upp
          i listan "Väntar på rolltilldelning" ovan.
        </p>
      </div>
    </div>
  )
}
