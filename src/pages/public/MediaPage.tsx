import { useEffect, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import type { MediaItem } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { mediaTypeLabel } from '../../lib/utils'

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [lightbox, setLightbox] = useState<MediaItem | null>(null)

  useEffect(() => {
    let query = supabase.from('media_items').select('*').eq('status', 'published').order('published_at', { ascending: false })
    if (filter) query = query.eq('media_type', filter)
    query.then(({ data }) => {
      setItems(data as MediaItem[] ?? [])
      setLoading(false)
    })
  }, [filter])

  useEffect(() => {
    if (!lightbox) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightbox])

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader slug="media" />
      </div>

      <div className="filter-bar">
        <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrera på typ">
          <option value="">Alla typer</option>
          <option value="image">Bilder</option>
          <option value="video">Videor</option>
          <option value="map">Kartor</option>
          <option value="graphic">Grafik</option>
          <option value="press_image">Pressbilder</option>
        </select>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>Inget material har publicerats ännu.</p>
        </div>
      ) : (
        <div className="media-gallery" style={{ marginBottom: 'var(--space-9)' }}>
          {items.map(item => (
            <div key={item.id} className="media-tile" onClick={() => item.media_type === 'image' && setLightbox(item)} role={item.media_type === 'image' ? 'button' : undefined} tabIndex={item.media_type === 'image' ? 0 : undefined}>
              {item.media_type === 'image' && item.file_url ? (
                <img src={item.file_url} alt={item.alt_text ?? item.title} />
              ) : item.media_type === 'video' && item.video_url ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-heading)', color: 'white', fontSize: '3rem' }}>▶</div>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-alt)', color: 'var(--text-muted)', fontSize: '3rem' }}>📄</div>
              )}
              <div className="media-tile-overlay">
                <div>
                  <p className="media-tile-title">{item.title}</p>
                  <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{mediaTypeLabel(item.media_type)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Stäng">×</button>
          <img src={lightbox.file_url ?? ''} alt={lightbox.alt_text ?? lightbox.title} />
          <div className="lightbox-info">
            <p>{lightbox.title}</p>
            {lightbox.photographer && <p>Foto: {lightbox.photographer}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
