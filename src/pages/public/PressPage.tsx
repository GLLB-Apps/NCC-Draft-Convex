import { useEffect, useState } from 'react'
import type { Post, DocumentItem, MediaItem, Contact } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate, formatDateShort, senderTypeLabel, senderTypeBadge } from '../../lib/utils'
import { usePage } from '../../lib/usePage'

export default function PressPage() {
  const page = usePage('press')
  const [posts, setPosts] = useState<Post[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [pressImages, setPressImages] = useState<MediaItem[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('posts').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(5),
      supabase.from('documents').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(10),
      supabase.from('media_items').select('*').eq('status', 'published').eq('is_press_allowed', true).order('published_at', { ascending: false }),
      supabase.from('contacts').select('*').eq('is_public', true).order('sort_order'),
    ]).then(([p, d, m, c]) => {
      setPosts(p.data as Post[] ?? [])
      setDocuments(d.data as DocumentItem[] ?? [])
      setPressImages(m.data as MediaItem[] ?? [])
      setContacts(c.data as Contact[] ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="container fade-in">
      <div className="page-header">
        <h1>{page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>

      <div className="press-grid" style={{ marginBottom: 'var(--space-9)' }}>
        <div>
          <div className="press-card">
            <h3>{page.text('facts_heading')}</h3>
            <ul style={{ paddingLeft: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {page.text('facts').split('\n').filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>

          {posts.length > 0 && (
            <div className="press-card">
              <h3>{page.text('press_heading')}</h3>
              {posts.map(p => (
                <div key={p.id} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-light)' }}>
                  <p style={{ fontWeight: 500 }}>{p.title}</p>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>{formatDateShort(p.published_at)}</p>
                </div>
              ))}
            </div>
          )}

          {documents.length > 0 && (
            <div className="press-card">
              <h3>{page.text('docs_heading')}</h3>
              {documents.map(d => (
                <div key={d.id} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500 }}>{d.title}</span>
                    {d.sender_type && <span className={senderTypeBadge(d.sender_type)}>{senderTypeLabel(d.sender_type)}</span>}
                  </div>
                  {d.description && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{d.description}</p>}
                  {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="section-link">Ladda ner →</a>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="press-card">
            <h3>{page.text('contacts_heading')}</h3>
            {contacts.map(c => (
              <div key={c.id} style={{ padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-light)' }}>
                <p style={{ fontWeight: 500 }}>{c.name}</p>
                {c.role && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{c.role}</p>}
                {c.email && <p style={{ fontSize: '0.85rem' }}><a href={`mailto:${c.email}`}>{c.email}</a></p>}
                {c.phone && <p className="text-muted" style={{ fontSize: '0.85rem' }}>{c.phone}</p>}
              </div>
            ))}
          </div>

          {pressImages.length > 0 && (
            <div className="press-card">
              <h3>{page.text('images_heading')}</h3>
              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                {pressImages.map(img => (
                  <div key={img.id}>
                    {img.file_url && <img src={img.file_url} alt={img.alt_text ?? img.title} style={{ width: '100%', borderRadius: 'var(--radius-md)' }} />}
                    <p style={{ fontSize: '0.8rem', marginTop: 'var(--space-1)' }}>{img.title}</p>
                    {img.rights_info && <p className="text-muted" style={{ fontSize: '0.75rem' }}>{img.rights_info}</p>}
                    {img.file_url && <a href={img.file_url} target="_blank" rel="noopener noreferrer" className="section-link" style={{ fontSize: '0.8rem' }}>Ladda ner →</a>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="press-card">
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              Senast uppdaterad: {formatDate(new Date().toISOString())}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
