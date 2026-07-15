import { Fragment, useEffect, useState } from 'react'
import type { NavigationItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'

export default function AdminNavigation() {
  const [items, setItems] = useState<NavigationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<NavigationItem | null>(null)
  const { show } = useToast()

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('navigation_items').select('*').order('sort_order').then(({ data }) => {
      setItems(data as NavigationItem[] ?? [])
      setLoading(false)
    })
  }

  const topLevel = items.filter(i => !i.parent_id)
  const childrenOf = (id: string) => items.filter(i => i.parent_id === id)
  const editingHasChildren = !!editing?.id && items.some(i => i.parent_id === editing.id)

  async function save() {
    if (!editing) return
    if (!editing.label.trim()) { show('Etikett krävs', 'error'); return }
    const payload = {
      label: editing.label.trim(),
      url: editing.url.trim(),
      sort_order: editing.sort_order,
      is_active: editing.is_active,
      parent_id: editing.parent_id || null,
    }
    if (editing.id) {
      const { error } = await supabase.from('navigation_items').update(payload).eq('id', editing.id)
      if (error) show('Kunde inte spara: ' + error.message, 'error')
      else show('Sparat', 'success')
    } else {
      const { error } = await supabase.from('navigation_items').insert(payload)
      if (error) show('Kunde inte skapa: ' + error.message, 'error')
      else show('Menyval skapat', 'success')
    }
    setEditing(null)
    load()
  }

  async function toggleActive(item: NavigationItem) {
    const { error } = await supabase.from('navigation_items').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) show('Kunde inte uppdatera: ' + error.message, 'error')
    else { show(item.is_active ? 'Menyval dolt' : 'Menyval visas', 'success'); load() }
  }

  // Reorder within the item's sibling group by swapping sort_order with its neighbour.
  async function move(item: NavigationItem, dir: -1 | 1) {
    const siblings = items.filter(i => (i.parent_id ?? null) === (item.parent_id ?? null))
    const idx = siblings.findIndex(s => s.id === item.id)
    const target = idx + dir
    if (target < 0 || target >= siblings.length) return
    const other = siblings[target]
    await Promise.all([
      supabase.from('navigation_items').update({ sort_order: other.sort_order }).eq('id', item.id),
      supabase.from('navigation_items').update({ sort_order: item.sort_order }).eq('id', other.id),
    ])
    load()
  }

  async function remove(item: NavigationItem) {
    const kids = items.filter(i => i.parent_id === item.id)
    const msg = kids.length
      ? `Ta bort "${item.label}"? Dess ${kids.length} underval flyttas till toppnivå.`
      : 'Ta bort detta menyval?'
    if (!confirm(msg)) return
    if (kids.length) {
      await Promise.all(kids.map(k => supabase.from('navigation_items').update({ parent_id: null }).eq('id', k.id)))
    }
    const { error } = await supabase.from('navigation_items').delete().eq('id', item.id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Borttaget', 'success'); load() }
  }

  function row(item: NavigationItem, isChild: boolean, index: number, siblingCount: number) {
    return (
      <div
        key={item.id}
        className={isChild ? 'admin-list-item admin-nav-child' : 'admin-list-item'}
        style={{ opacity: item.is_active ? 1 : 0.55 }}
      >
        <div className="admin-nav-reorder">
          <button className="btn btn-ghost btn-xs" onClick={() => move(item, -1)} disabled={index === 0} aria-label="Flytta upp">↑</button>
          <button className="btn btn-ghost btn-xs" onClick={() => move(item, 1)} disabled={index === siblingCount - 1} aria-label="Flytta ned">↓</button>
        </div>
        <div className="admin-list-item-info">
          <div className="admin-list-item-title">
            {isChild && <span aria-hidden="true" style={{ color: 'var(--text-muted)', marginRight: 6 }}>↳</span>}
            {item.label}
            {!item.url && <span className="badge badge-muted" style={{ marginLeft: 8 }}>Grupp</span>}
          </div>
          <div className="admin-list-item-meta">
            {item.url && <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{item.url}</span>}
            {!item.is_active && <span className="badge badge-muted">Dold</span>}
          </div>
        </div>
        <div className="admin-table-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(item)}>{item.is_active ? 'Dölj' : 'Visa'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(item)}>Redigera</button>
          <button className="btn btn-danger btn-sm" onClick={() => remove(item)}>Ta bort</button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Meny</h1>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => setEditing({ id: '', label: '', url: '/', sort_order: items.length, is_active: true, parent_id: null } as NavigationItem)}
        >
          Nytt menyval
        </button>
      </div>

      <p className="text-muted" style={{ marginBottom: 'var(--space-5)', fontSize: '0.9rem' }}>
        Menyvalen styr huvudmenyn (och sidfoten). Välj en <strong>överordnad</strong> meny för att skapa undernavigering —
        toppnivåval med underval visas som en rullgardin. Lämna länken tom för en ren grupprubrik. Dölj ett val för att
        tillfälligt ta bort det utan att radera det.
      </p>

      {editing && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3>{editing.id ? 'Redigera menyval' : 'Nytt menyval'}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Stäng</button>
          </div>
          <div className="grid grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="label">Etikett *</label>
              <input id="label" className="form-input" type="text" value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder="t.ex. Nyheter" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="url">Länk (URL)</label>
              <input id="url" className="form-input" type="text" value={editing.url} onChange={e => setEditing({ ...editing, url: e.target.value })} placeholder="t.ex. /nyheter — lämna tom för grupp" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="parent">Överordnad meny</label>
            <select
              id="parent"
              className="form-select"
              value={editing.parent_id ?? ''}
              disabled={editingHasChildren}
              onChange={e => setEditing({ ...editing, parent_id: e.target.value || null })}
            >
              <option value="">— Toppnivå —</option>
              {topLevel.filter(i => i.id !== editing.id).map(i => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
            {editingHasChildren && (
              <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
                Detta val har egna underval och kan därför inte själv bli underordnat.
              </p>
            )}
          </div>
          <div className="checkbox-group">
            <input id="is_active" type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} />
            <label htmlFor="is_active" className="form-label" style={{ margin: 0 }}>Visa i menyn</label>
          </div>
          <button className="btn btn-primary btn-sm" onClick={save}>Spara</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state"><p>Inga menyval finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {topLevel.map((item, ti) => {
            const kids = childrenOf(item.id)
            return (
              <Fragment key={item.id}>
                {row(item, false, ti, topLevel.length)}
                {kids.map((c, ci) => row(c, true, ci, kids.length))}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
