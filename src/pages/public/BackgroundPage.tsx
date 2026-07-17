import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { SiteSettings, ContentBlock } from '../../lib/types'
import PageHeader from '../../components/public/PageHeader'
import { BlockList, BlockCta } from '../../components/public/blocks'

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': return <h2 className="block-heading">{block.text}</h2>
    case 'paragraph': return <p className="block-paragraph">{block.text}</p>
    case 'quote': return <blockquote className="block-quote">{block.text}</blockquote>
    case 'list': return <BlockList block={block} />
    case 'cta': return <BlockCta block={block} />
    case 'factbox': return (
      <div className="block-factbox">
        {block.title && <h4>{block.title}</h4>}
        <p>{block.text}</p>
      </div>
    )
    case 'warning': return (
      <div className="block-warning">
        {block.title && <h4>{block.title}</h4>}
        <p>{block.text}</p>
      </div>
    )
    case 'image': return (
      <figure className="block-image">
        {block.image_url && <img src={block.image_url} alt={block.alt_text ?? ''} />}
        {block.text && <figcaption className="block-image-caption">{block.text}</figcaption>}
      </figure>
    )
    case 'video': return (
      <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {block.video_url && (
          <iframe
            src={block.video_url}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            allowFullScreen
            title={block.title ?? 'Video'}
          />
        )}
      </div>
    )
    case 'divider': return <hr className="block-divider" />
    case 'button': return (
      <a href={block.url} target="_blank" rel="noopener noreferrer" className="block-button">{block.text}</a>
    )
    case 'sources': return (
      <div className="block-sources">
        <h4>Källförteckning</h4>
        <ul>
          {block.sources?.map((s, i) => (
            <li key={i}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a></li>
          ))}
        </ul>
      </div>
    )
    default: return null
  }
}

export default function BackgroundPage() {
  const { settings } = useOutletContext<{ settings: SiteSettings | null }>()
  const [blocks, setBlocks] = useState<ContentBlock[]>([])

  useEffect(() => {
    if (settings && Array.isArray(settings.background_blocks)) {
      setBlocks(settings.background_blocks)
    }
  }, [settings])

  const hasBlocks = blocks.length > 0

  return (
    <div className="container container-narrow fade-in">
      <div className="page-header">
        <PageHeader slug="bakgrund" />
      </div>

      {hasBlocks ? (
        <div className="content-blocks" style={{ marginBottom: 'var(--space-9)' }}>
          {blocks.map((block, i) => (
            <ContentBlockRenderer key={i} block={block} />
          ))}
        </div>
      ) : (
        <div className="empty-state" style={{ marginBottom: 'var(--space-9)' }}>
          <p>Innehållet för den här sidan har inte lagts till ännu.</p>
        </div>
      )}
    </div>
  )
}
