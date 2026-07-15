import { useEffect, useState } from 'react'
import PageHeader from '../../components/public/PageHeader'
import { Link } from 'react-router-dom'
import type { Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDateShort, truncate } from '../../lib/utils'

export default function NewsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .eq('status', 'published')
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setPosts(data as Post[] ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader slug="nyheter" />
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <p>Inga nyheter är publicerade ännu.</p>
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginBottom: 'var(--space-9)' }}>
          {posts.map(post => (
            <Link key={post.id} to={`/nyheter/${post.slug}`} className="card card-clickable news-card">
              {post.featured_image && (
                <img src={post.featured_image} alt="" className="news-card-image" />
              )}
              <div>
                <span className="news-card-date">{formatDateShort(post.published_at)}</span>
                {post.is_pinned && <span className="badge badge-warning" style={{ marginLeft: 'var(--space-2)' }}>Fäst</span>}
              </div>
              <h3>{post.title}</h3>
              {post.excerpt && <p>{truncate(post.excerpt, 150)}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
