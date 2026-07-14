import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { formatDateShort, statusLabel, statusBadgeClass } from '../../lib/utils'

export default function AdminNews() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()

  function load() {
    setLoading(true)
    supabase.from('posts').select('*')
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data as Post[] ?? [])
        setLoading(false)
      })
  }

  useEffect(() => { load() }, [])

  async function remove(id: string, title: string) {
    if (!confirm(`Ta bort nyheten "${title}" permanent?`)) return
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Nyheten borttagen', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Nyheter</h1>
        <Link to="/admin/nyheter/ny" className="btn btn-primary btn-sm">Ny nyhet</Link>
      </div>
      {posts.length === 0 ? (
        <div className="empty-state"><p>Inga nyheter finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {posts.map(p => (
            <div key={p.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">
                  {p.title} {p.is_pinned && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Fäst</span>}
                </div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span>
                  <span>/{p.slug}</span>
                  <span>{formatDateShort(p.published_at)}</span>
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={`/admin/nyheter/${p.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id, p.title)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
