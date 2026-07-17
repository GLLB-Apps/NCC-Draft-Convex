import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Post, ContentBlock } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { BlockList, BlockCta } from '../../components/public/blocks'
import { useRegisterEditLink } from '../../lib/editLink'

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': return <h2 className="block-heading">{block.text}</h2>
    case 'paragraph': return <p className="block-paragraph">{block.text}</p>
    case 'quote': return <blockquote className="block-quote">{block.text}</blockquote>
    case 'list': return <BlockList block={block} />
    case 'cta': return <BlockCta block={block} />
    case 'factbox': return <div className="block-factbox">{block.title && <h4>{block.title}</h4>}<p>{block.text}</p></div>
    case 'warning': return <div className="block-warning">{block.title && <h4>{block.title}</h4>}<p>{block.text}</p></div>
    case 'image': return <figure className="block-image">{block.image_url && <img src={block.image_url} alt={block.alt_text ?? ''} />}{block.text && <figcaption className="block-image-caption">{block.text}</figcaption>}</figure>
    case 'video': return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {block.video_url && <iframe src={block.video_url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} allowFullScreen title={block.title ?? 'Video'} />}
      </div>
    )
    case 'divider': return <hr className="block-divider" />
    case 'button': return <a href={block.url} target="_blank" rel="noopener noreferrer" className="block-button">{block.text}</a>
    case 'sources': return (
      <div className="block-sources">
        <h4>Källförteckning</h4>
        <ul>{block.sources?.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>)}</ul>
      </div>
    )
    default: return null
  }
}

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        setPost(data as Post | null)
        setLoading(false)
      })
  }, [slug])

  useRegisterEditLink(post ? `/admin/nyheter/${post.id}` : null)

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!post) {
    return (
      <div className="empty-state">
        <h1>Nyheten hittades inte</h1>
        <Link to="/nyheter" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>Tillbaka till nyheter</Link>
      </div>
    )
  }

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <Link to="/nyheter" className="section-link" style={{ marginBottom: 'var(--space-3)' }}>← Alla nyheter</Link>
        <h1>{post.title}</h1>
        {post.excerpt && <p>{post.excerpt}</p>}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          {post.published_at && <span className="text-muted" style={{ fontSize: '0.85rem' }}>{formatDate(post.published_at)}</span>}
          {post.author && <span className="text-muted" style={{ fontSize: '0.85rem' }}>Av {post.author}</span>}
        </div>
      </div>

      {post.featured_image && (
        <img src={post.featured_image} alt={post.image_caption ?? ''} style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-7)' }} />
      )}
      {post.image_caption && (
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '-var(--space-4)', marginBottom: 'var(--space-7)' }}>{post.image_caption}</p>
      )}

      {Array.isArray(post.content) && post.content.length > 0 ? (
        <div className="content-blocks">
          {post.content.map((block, i) => <ContentBlockRenderer key={i} block={block} />)}
        </div>
      ) : (
        <p className="text-muted">Innehåll saknas.</p>
      )}
    </div>
  )
}
