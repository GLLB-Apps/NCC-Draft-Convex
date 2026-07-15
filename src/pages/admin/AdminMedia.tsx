import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MediaItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { formatDateShort, statusLabel, statusBadgeClass, mediaTypeLabel } from '../../lib/utils'
import Dropzone from '../../components/admin/Dropzone'

export default function AdminMedia() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { show } = useToast()

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('media_items').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      setItems(data as MediaItem[] ?? [])
      setLoading(false)
    })
  }

  async function addUploaded(url: string, file: File) {
    const title = file.name.replace(/\.[^.]+$/, '')
    const { error } = await supabase.from('media_items').insert({
      title,
      media_type: 'image',
      file_url: url,
      status: 'draft',
      created_by: user?.id,
      updated_by: user?.id,
    })
    if (error) throw new Error(error.message)
  }

  async function remove(id: string) {
    if (!confirm('Ta bort denna media?')) return
    const { error } = await supabase.from('media_items').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Media borttagen', 'success'); load() }
  }

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Media</h1>
        <Link to="/admin/media/ny" className="btn btn-ghost btn-sm">Lägg till manuellt</Link>
      </div>

      <Dropzone
        multiple
        label="Dra och släpp bilder här för att ladda upp"
        hint="eller klicka för att välja — de sparas som utkast"
        onUploaded={addUploaded}
        onComplete={() => { show('Bilder uppladdade', 'success'); load() }}
        onError={m => show('Uppladdning misslyckades: ' + m, 'error')}
      />

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : items.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 'var(--space-5)' }}><p>Inget media finns ännu.</p></div>
      ) : (
        <div className="media-grid">
          {items.map(m => (
            <div key={m.id} className="media-card">
              <Link to={`/admin/media/${m.id}`} className="media-card-thumb">
                {m.file_url
                  ? <img src={m.file_url} alt={m.alt_text ?? m.title} loading="lazy" />
                  : <span className="media-card-placeholder" aria-hidden="true">{mediaTypeLabel(m.media_type)}</span>}
                <span className={`media-card-status ${statusBadgeClass(m.status)}`}>{statusLabel(m.status)}</span>
              </Link>
              <div className="media-card-body">
                <div className="media-card-title">{m.title}</div>
                <div className="media-card-meta">{mediaTypeLabel(m.media_type)}{m.media_date ? ` · ${formatDateShort(m.media_date)}` : ''}</div>
                <div className="media-card-actions">
                  <Link to={`/admin/media/${m.id}`} className="btn btn-secondary btn-xs">Redigera</Link>
                  <button className="btn btn-danger btn-xs" onClick={() => remove(m.id)}>Ta bort</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
