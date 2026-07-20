import { useEffect, useState } from 'react'
import { ImageIcon, MapPin, Megaphone } from 'lucide-react'
import type { Testimony, TestimonyStatus } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { useMarkSourceRead } from '../../lib/notifications'
import { formatDateShort, statusLabel, statusBadgeClass } from '../../lib/utils'
import MapPicker from '../../components/public/MapPicker'

export default function AdminTestimonies() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [selected, setSelected] = useState<Testimony | null>(null)
  const [note, setNote] = useState('')
  const { user } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  useMarkSourceRead('testimonies', !loading)

  useEffect(() => {
    loadTestimonies()
  }, [])

  function loadTestimonies() {
    setLoading(true)
    supabase.from('testimonies').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setTestimonies(data as Testimony[] ?? [])
      setLoading(false)
    })
  }

  async function updateStatus(t: Testimony, status: TestimonyStatus) {
    const payload: Record<string, unknown> = { status }
    if (status === 'approved' && !t.published_at) payload.published_at = new Date().toISOString()
    const { error } = await supabase.from('testimonies').update(payload).eq('id', t.id)
    if (error) { show('Kunde inte uppdatera: ' + error.message, 'error'); return }

    // On approval, if the submitter allowed marketing use, add the image to the
    // media library (flagged for the marketing tab).
    if (status === 'approved' && t.consent_marketing && t.featured_image) {
      const { error: mErr } = await supabase.from('media_items').insert({
        title: t.title || 'Vittnesmål',
        description: t.story ? t.story.slice(0, 200) : null,
        alt_text: t.title || 'Bild från vittnesmål',
        media_type: 'image',
        file_url: t.featured_image,
        marketing_ok: true,
        status: 'draft',
        created_by: user?.id,
        updated_by: user?.id,
      })
      if (mErr) show('Vittnesmål godkänt, men bilden kunde inte läggas i Media: ' + mErr.message, 'error')
      else show('Godkänt – bilden tillagd i Media (marknadsföring)', 'success')
    } else {
      show('Status uppdaterad', 'success')
    }
    loadTestimonies()
    setSelected(null)
  }

  /**
   * Endast avslagna vittnesmål går att ta bort. Väntande ska granskas och
   * godkända ligger publicerade — båda avslutas via status, inte radering.
   */
  async function removeRejected(t: Testimony) {
    if (t.status !== 'rejected') return
    if (!(await confirm({
      message: `Ta bort det avslagna vittnesmålet "${t.title || 'Utan titel'}" permanent? Det går inte att ångra.`,
      confirmText: 'Ta bort',
      danger: true,
    }))) return
    const { error } = await supabase.from('testimonies').delete().eq('id', t.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    show('Vittnesmål borttaget', 'success')
    if (selected?.id === t.id) setSelected(null)
    loadTestimonies()
  }

  async function saveNote() {
    if (!selected) return
    const { error } = await supabase.from('testimonies').update({ internal_note: note }).eq('id', selected.id)
    if (error) show('Kunde inte spara anteckning', 'error')
    else { show('Anteckning sparad', 'success'); loadTestimonies() }
  }

  const filtered = filter ? testimonies.filter(t => t.status === filter) : testimonies

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Vittnesmål</h1>
        <select className="form-select" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrera på status">
          <option value="">Alla</option>
          <option value="pending">Väntar</option>
          <option value="approved">Godkända</option>
          <option value="rejected">Avslagna</option>
        </select>
      </div>

      {selected && (
        <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3>{selected.title || 'Utan titel'}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Stäng</button>
          </div>
          {selected.featured_image && (
            <img src={selected.featured_image} alt="" className="testimony-admin-image" />
          )}
          <p style={{ marginBottom: 'var(--space-3)' }}>{selected.story}</p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            <span>Av: {selected.is_anonymous ? 'Anonym' : selected.author_name ?? 'Anonym'}</span>
            {selected.location && <span>Ort: {selected.location}</span>}
            {selected.area_usage && <span>Användning: {selected.area_usage}</span>}
            <span>E-post: {selected.email}</span>
            {selected.consent_marketing && (
              <span className="badge badge-success testimony-flag">
                <Megaphone size={13} aria-hidden="true" /> Godkänd för marknadsföring
              </span>
            )}
          </div>
          {selected.map_lat != null && selected.map_lng != null && (
            <div className="form-group">
              <label className="form-label testimony-flag">
                <MapPin size={14} aria-hidden="true" /> Utpekad plats på kartan
              </label>
              <MapPicker lat={selected.map_lat} lng={selected.map_lng} readOnly height={220} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="note">Intern anteckning</label>
            <textarea id="note" className="form-textarea" rows={2} value={note} onChange={e => setNote(e.target.value)} defaultValue={selected.internal_note ?? ''} />
          </div>
          <div className="admin-form-actions">
            <button className="btn btn-primary btn-sm" onClick={saveNote}>Spara anteckning</button>
            <button className="btn btn-success btn-sm" onClick={() => updateStatus(selected, 'approved')}>Godkänn</button>
            {selected.status === 'rejected' ? (
              <button className="btn btn-danger btn-sm" onClick={() => removeRejected(selected)}>Ta bort permanent</button>
            ) : (
              <button className="btn btn-danger btn-sm" onClick={() => updateStatus(selected, 'rejected')}>Avslå</button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state"><p>Inga vittnesmål finns.</p></div>
      ) : (
        <div className="admin-list">
          {filtered.map(t => (
            <div key={t.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{t.title || 'Utan titel'}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(t.status)}>{statusLabel(t.status)}</span>
                  <span>{t.is_anonymous ? 'Anonym' : t.author_name ?? 'Anonym'}</span>
                  <span>{formatDateShort(t.created_at)}</span>
                  {t.featured_image && (
                    <span className="testimony-flag" title="Har bild">
                      <ImageIcon size={14} aria-hidden="true" /><span className="sr-only">Har bild</span>
                    </span>
                  )}
                  {t.map_lat != null && t.map_lng != null && (
                    <span className="testimony-flag" title="Utpekad plats på kartan">
                      <MapPin size={14} aria-hidden="true" /><span className="sr-only">Utpekad plats på kartan</span>
                    </span>
                  )}
                  {t.consent_marketing && (
                    <span className="testimony-flag is-ok" title="Godkänd för marknadsföring">
                      <Megaphone size={14} aria-hidden="true" /><span className="sr-only">Godkänd för marknadsföring</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="admin-table-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(t); setNote(t.internal_note ?? '') }}>Granska</button>
                {t.status === 'rejected' && (
                  <button className="btn btn-danger btn-sm" onClick={() => removeRejected(t)}>Ta bort</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
