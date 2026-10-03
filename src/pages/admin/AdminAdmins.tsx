import { useEffect, useMemo, useState } from 'react'
import UserAvatar from '../../components/UserAvatar'
import PasswordField from '../../components/PasswordField'
import { convexClient } from '../../lib/convexClient'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { formatDateShort } from '../../lib/utils'
import type { UserRole } from '../../lib/types'

// En behörighetsnivå per person. De tre första är admin-roller; "intranet"
// och "viewer" är ren intranätsåtkomst (intranet_member/intranet_read_only)
// och ger INGEN åtkomst till adminpanelen.
//
// Till skillnad från Appwrite-/PHP-versionen ligger role/intranet_member/
// intranet_read_only/display_name/intro/email redan på SAMMA users-dokument
// (se convex/schema.ts) — inget att slå ihop från tre tabeller eller ett
// separat e-postanrop, se convex/users.ts: listAll.
type Level = UserRole | 'intranet' | 'viewer'

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: 'superadmin', label: 'Superadmin', desc: 'Full åtkomst: allt innehåll, inställningar och användarhantering.' },
  { value: 'redaktor', label: 'Redaktör', desc: 'Allt innehåll och kommunikation. Inte inställningar eller användare.' },
  { value: 'skribent', label: 'Skribent', desc: 'Skriver nyheter, ämnen, dokument och media.' },
  { value: 'intranet', label: 'Intranät', desc: 'Det interna arbetsrummet – läser och skriver. Ingen adminpanel.' },
  { value: 'viewer', label: 'Intranät (läsa)', desc: 'Ser det interna arbetsrummet men kan inte skapa eller ändra något.' },
]
const levelLabel = (l: Level) => LEVELS.find(x => x.value === l)?.label ?? l
const isAdminLevel = (l: Level): l is UserRole => l !== 'intranet' && l !== 'viewer'
const isIntranetLevel = (l: Level) => l === 'intranet' || l === 'viewer'

interface Person {
  user_id: Id<'users'>
  email: string
  level: Level
  display_name: string | null
  intro: string | null
  created_at: string
}
interface PendingUser { id: Id<'users'>; email: string; display_name: string | null; intro: string | null; created_at: string }

export default function AdminAdmins() {
  const { user: currentUser, role: currentRole } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [people, setPeople] = useState<Person[]>([])
  const [pending, setPending] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [pwdFor, setPwdFor] = useState<string | null>(null)
  const [pwdValue, setPwdValue] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [sendingPwd, setSendingPwd] = useState<string | null>(null)
  const [introFor, setIntroFor] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!pwdFor) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPwdFor(null); setPwdValue('') } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pwdFor])

  async function load() {
    setLoading(true)
    const all = await convexClient.query(api.users.listAll, {})

    const activeRows = all.filter(u => u.role !== null || u.intranet_member)
    const list: Person[] = activeRows.map(u => ({
      user_id: u.id, email: u.email,
      level: (u.role ?? (u.intranet_read_only ? 'viewer' : 'intranet')) as Level,
      display_name: u.display_name, intro: u.intro, created_at: u.created_at,
    }))

    setPeople(list)
    setPending(all.filter(u => u.role === null && !u.intranet_member)
      .map(u => ({ id: u.id, email: u.email, display_name: u.display_name, intro: u.intro, created_at: u.created_at })))
    setLoading(false)
  }

  /** Ger en person utan åtkomst en startnivå. */
  async function assignLevel(u: PendingUser, level: Level) {
    setBusy(u.id)
    try {
      await convexClient.mutation(api.users.setAccess, {
        userId: u.id,
        role: isAdminLevel(level) ? level : null,
        intranet_member: isIntranetLevel(level),
        intranet_read_only: level === 'viewer',
      })
      show(`${u.display_name || 'Användaren'}: ${levelLabel(level)}`, 'success')
      load()
    } catch (e) {
      show('Kunde inte tilldela: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setBusy(null) }
  }

  /** Byter nivå på en person med befintlig åtkomst. */
  async function changeLevel(p: Person, next: Level) {
    if (next === p.level) return
    setBusy(p.user_id)
    try {
      await convexClient.mutation(api.users.setAccess, {
        userId: p.user_id,
        role: isAdminLevel(next) ? next : null,
        intranet_member: isIntranetLevel(next),
        intranet_read_only: next === 'viewer',
      })
      show(`${p.display_name || 'Användaren'}: ${levelLabel(next)}`, 'success')
      load()
    } catch (e) {
      show('Kunde inte ändra: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setBusy(null) }
  }

  /** Raderar ett konto som ännu inte fått någon nivå. */
  async function deleteAccount(u: PendingUser) {
    const namn = u.display_name || u.email || 'kontot'
    if (!(await confirm({
      message: `Radera ${namn} permanent? Kontot och dess presentation tas bort helt och personen kan inte logga in igen. Det går inte att ångra.`,
      confirmText: 'Radera kontot',
      danger: true,
    }))) return
    setBusy(u.id)
    try {
      await convexClient.mutation(api.users.deleteUser, { userId: u.id })
      show(`${namn} raderat`, 'success')
      load()
    } catch (e) {
      show('Kunde inte radera: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setBusy(null) }
  }

  async function removeAccess(p: Person) {
    if (p.user_id === currentUser?.id) { show('Du kan inte ta bort dig själv', 'error'); return }
    if (!(await confirm({ message: `Ta bort all åtkomst för ${p.display_name || 'användaren'}?`, confirmText: 'Ta bort åtkomst', danger: true }))) return
    setBusy(p.user_id)
    try {
      await convexClient.mutation(api.users.setAccess, { userId: p.user_id, role: null, intranet_member: false, intranet_read_only: false })
      show('Åtkomst borttagen', 'success')
      load()
    } catch (e) {
      show('Kunde inte ta bort: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setBusy(null) }
  }

  async function setUserPassword(userId: Id<'users'>) {
    if (pwdValue.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    setPwdBusy(true)
    try {
      await convexClient.action(api.users.setPassword, { userId, password: pwdValue })
      show('Lösenordet uppdaterat', 'success')
      setPwdFor(null); setPwdValue('')
    } catch (e) {
      show('Kunde inte ändra lösenord: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setPwdBusy(false) }
  }

  /** Sätter det inskrivna lösenordet och mejlar samma lösenord till personen. */
  async function emailUserPassword(userId: Id<'users'>) {
    if (pwdValue.length < 8) { show('Lösenordet måste vara minst 8 tecken', 'error'); return }
    setSendingPwd(userId)
    try {
      await convexClient.action(api.users.sendPassword, { userId, password: pwdValue })
      show('Lösenordet uppdaterat och skickat via mejl', 'success')
      setPwdFor(null); setPwdValue('')
    } catch (e) {
      show('Kunde inte skicka: ' + (e instanceof Error ? e.message : String(e)), 'error')
    } finally { setSendingPwd(null) }
  }

  const adminCount = useMemo(() => people.filter(p => isAdminLevel(p.level)).length, [people])
  const memberCount = people.length - adminCount

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Användare</h1>
      </div>

      {/* Förklaring av nivåerna */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0, marginBottom: 'var(--space-3)' }}>Nivåer</h2>
        <ul className="admin-level-legend">
          {LEVELS.map(l => (
            <li key={l.value}>
              <span className="badge badge-muted">{l.label}</span>
              <span>{l.desc}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 'var(--space-3)', marginBottom: 0 }}>
          Admin-nivåerna har alltid intranätsåtkomst också. Nivån <strong>Intranät</strong> ger däremot
          bara det interna arbetsrummet.
        </p>
      </div>

      {/* Väntar på nivå */}
      {pending.length > 0 && (
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', color: 'var(--warning)' }}>
            Väntar på nivå ({pending.length})
          </h2>
          <div className="admin-list">
            {pending.map(u => (
              <div key={u.id} className="admin-list-item" style={{ flexWrap: 'wrap' }}>
                <UserAvatar seed={u.email ?? u.id} size={36} style={{ flexShrink: 0 }} />
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">{u.display_name ?? 'Namnlös användare'}</div>
                  <div className="admin-list-item-meta">
                    <span className="badge badge-warning">Ingen åtkomst</span>
                    {u.email && <span className="admin-user-email">{u.email}</span>}
                    <span>{formatDateShort(u.created_at)}</span>
                  </div>
                  {u.intro
                    ? <p className="admin-user-intro">{u.intro}</p>
                    : <p className="admin-user-intro is-missing">Ingen presentation – kontot skapades innan presentation blev obligatorisk.</p>}
                </div>
                <div className="admin-table-actions">
                  <select
                    className="form-select" style={{ width: 'auto' }} defaultValue=""
                    disabled={busy === u.id}
                    onChange={e => { if (e.target.value) assignLevel(u, e.target.value as Level) }}
                    aria-label="Tilldela nivå"
                  >
                    <option value="" disabled>Tilldela nivå…</option>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy === u.id}
                    onClick={() => deleteAccount(u)}
                  >
                    Radera konto
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)' }}>
        Aktiva behörigheter ({people.length}) <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 400 }}>· {adminCount} admin, {memberCount} intranät</span>
      </h2>

      {people.length === 0 ? (
        <div className="empty-state"><p>Ingen har åtkomst ännu.</p></div>
      ) : (
        <div className="admin-list">
          {people.map(p => {
            const isSelf = p.user_id === currentUser?.id
            const lockSelf = isSelf && currentRole === 'superadmin'
            return (
              <div key={p.user_id} className="admin-list-item" style={{ flexWrap: 'wrap' }}>
                <UserAvatar seed={p.email ?? p.user_id} size={36} style={{ flexShrink: 0 }} />
                <div className="admin-list-item-info">
                  <div className="admin-list-item-title">
                    {p.display_name ?? 'Okänd användare'}
                    {isSelf && <span className="badge badge-success" style={{ marginLeft: 'var(--space-2)' }}>Du</span>}
                  </div>
                  <div className="admin-list-item-meta">
                    <span className={isAdminLevel(p.level) ? 'badge badge-muted' : 'badge badge-success'}>{levelLabel(p.level)}</span>
                    {p.email && <span className="admin-user-email">{p.email}</span>}
                    <span>{formatDateShort(p.created_at)}</span>
                  </div>
                </div>
                <div className="admin-table-actions">
                  <select
                    className="form-select" style={{ width: 'auto' }}
                    value={p.level}
                    onChange={e => changeLevel(p, e.target.value as Level)}
                    disabled={lockSelf || busy === p.user_id}
                    aria-label="Ändra nivå"
                  >
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                  {p.intro && (
                    <button
                      className="btn btn-ghost btn-sm"
                      aria-expanded={introFor === p.user_id}
                      onClick={() => setIntroFor(introFor === p.user_id ? null : p.user_id)}
                    >
                      {introFor === p.user_id ? 'Dölj presentation' : 'Presentation'}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => { setPwdFor(p.user_id); setPwdValue('') }}>
                    Byt lösenord
                  </button>
                  {!isSelf && (
                    <button className="btn btn-danger btn-sm" disabled={busy === p.user_id} onClick={() => removeAccess(p)}>Ta bort</button>
                  )}
                </div>
                {introFor === p.user_id && p.intro && (
                  <p className="admin-user-intro" style={{ flexBasis: '100%' }}>{p.intro}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--space-6)', background: 'var(--bg-alt)' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Ny person: den skapar ett konto via <a href="/admin/login" className="section-link">/admin/login</a>, presenterar
          sig i formuläret och dyker sedan upp under "Väntar på nivå" – med presentationen synlig – där du väljer behörighet.
          Skräp- och testkonton raderas därifrån. Ett konto som redan har en behörighet måste först fråntas den;
          då hamnar det i väntelistan och går att radera.
        </p>
      </div>

      {pwdFor && (() => {
        const p = people.find(x => x.user_id === pwdFor)
        if (!p) return null
        const isSelf = p.user_id === currentUser?.id
        const close = () => { setPwdFor(null); setPwdValue('') }
        return (
          <div className="admin-modal-backdrop" onClick={close}>
            <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Byt lösenord" onClick={e => e.stopPropagation()}>
              <div className="admin-modal-head">
                <h3>Byt lösenord — {p.display_name || p.email || 'användaren'}</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Stäng</button>
              </div>
              <PasswordField
                name={p.email ?? p.user_id}
                label="Nytt lösenord (minst 8 tecken)"
                value={pwdValue}
                onValueChange={setPwdValue}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') setUserPassword(p.user_id) }}
              />
              <div className="admin-modal-actions">
                <button className="btn btn-ghost btn-sm" onClick={close}>Avbryt</button>
                {!isSelf && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={pwdBusy || sendingPwd === p.user_id || pwdValue.length < 8}
                    onClick={() => emailUserPassword(p.user_id)}
                    data-tooltip="Sätter det inskrivna lösenordet och mejlar samma lösenord till personen"
                  >
                    {sendingPwd === p.user_id ? 'Skickar…' : 'Mejla lösenordet'}
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={() => setUserPassword(p.user_id)} disabled={pwdBusy || sendingPwd === p.user_id}>
                  {pwdBusy ? 'Sparar…' : 'Spara lösenord'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
