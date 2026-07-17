import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Topic, ContentBlock } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import LucideIcon from '../../lib/lucide'
import { BlockList, BlockCta } from '../../components/public/blocks'
import { useRegisterEditLink } from '../../lib/editLink'

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading':
      return <h2 className="block-heading">{block.text}</h2>
    case 'paragraph':
      return <p className="block-paragraph">{block.text}</p>
    case 'quote':
      return <blockquote className="block-quote">{block.text}</blockquote>
    case 'list':
      return <BlockList block={block} />
    case 'cta':
      return <BlockCta block={block} />
    case 'factbox':
      return (
        <div className="block-factbox">
          {block.title && <h4>{block.title}</h4>}
          <p>{block.text}</p>
        </div>
      )
    case 'warning':
      return (
        <div className="block-warning">
          {block.title && <h4>{block.title ?? 'Viktigt'}</h4>}
          <p>{block.text}</p>
        </div>
      )
    case 'image':
      return (
        <figure className="block-image">
          {block.image_url && <img src={block.image_url} alt={block.alt_text ?? ''} />}
          {block.text && <figcaption className="block-image-caption">{block.text}</figcaption>}
        </figure>
      )
    case 'video':
      return (
        <div className="block-video">
          {block.video_url && (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <iframe
                src={block.video_url}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={block.title ?? 'Video'}
              />
            </div>
          )}
        </div>
      )
    case 'divider':
      return <hr className="block-divider" />
    case 'button':
      return (
        <a href={block.url} target="_blank" rel="noopener noreferrer" className="block-button">
          {block.text}
        </a>
      )
    case 'sources':
      return (
        <div className="block-sources">
          <h4>Källförteckning</h4>
          <ul>
            {block.sources?.map((s, i) => (
              <li key={i}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'links':
      return (
        <div className="block-sources">
          <h4>{block.title ?? 'Relaterade länkar'}</h4>
          <ul>
            {block.links?.map((l, i) => (
              <li key={i}>
                <a href={l.url} target="_blank" rel="noopener noreferrer">{l.label}</a>
              </li>
            ))}
          </ul>
        </div>
      )
    case 'comparison':
      return (
        <div className="block-sources">
          {block.title && <h4>{block.title}</h4>}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {block.rows?.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 'var(--space-2) var(--space-3)', fontWeight: 500 }}>{r.label}</td>
                  <td style={{ padding: 'var(--space-2) var(--space-3)' }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

export default function TopicDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('topics')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data }) => {
        setTopic(data as Topic | null)
        setLoading(false)
      })
  }, [slug])

  useRegisterEditLink(topic ? `/admin/amnen/${topic.id}` : null)

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  if (!topic) {
    return (
      <div className="empty-state">
        <h1>Ämnet hittades inte</h1>
        <p>Det här ämnet är inte tillgängligt eller har inte publicerats.</p>
        <Link to="/amnen" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>Tillbaka till ämnen</Link>
      </div>
    )
  }

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <Link to="/amnen" className="section-link" style={{ marginBottom: 'var(--space-3)' }}>← Alla ämnen</Link>
        {topic.icon && (
          <div className="topic-detail-icon" aria-hidden="true">
            <LucideIcon icon={topic.icon} className="topic-icon-svg" />
          </div>
        )}
        <h1>{topic.title}</h1>
        {topic.intro && <p>{topic.intro}</p>}
        {topic.published_at && (
          <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 'var(--space-2)' }}>
            Publicerad {formatDate(topic.published_at)}
          </p>
        )}
      </div>

      {topic.featured_image && (
        <img src={topic.featured_image} alt={topic.title} style={{ width: '100%', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-7)' }} />
      )}

      {Array.isArray(topic.content) && topic.content.length > 0 ? (
        <div className="content-blocks">
          {topic.content.map((block, i) => (
            <ContentBlockRenderer key={i} block={block} />
          ))}
        </div>
      ) : (
        <p className="text-muted">Innehåll saknas för detta ämne.</p>
      )}
    </div>
  )
}
