import { Link } from 'react-router-dom'
import type { ContentBlock } from '../../lib/types'

// Renders a single content block. Shared across pages that show free-form
// block content (background, press, …).
export function RenderBlock({ block }: { block: ContentBlock }) {
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
          <iframe src={block.video_url} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} allowFullScreen title={block.title ?? 'Video'} />
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

// Renders a list of content blocks inside a `.content-blocks` wrapper.
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  if (!blocks.length) return null
  return (
    <div className="content-blocks">
      {blocks.map((block, i) => <RenderBlock key={i} block={block} />)}
    </div>
  )
}

// Bullet-list card block.
export function BlockList({ block }: { block: ContentBlock }) {
  const items = (block.items ?? []).filter(Boolean)
  if (!items.length && !block.title) return null
  return (
    <div className="block-list">
      {block.title && <h3 className="block-list-title">{block.title}</h3>}
      <ul className="block-list-items">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  )
}

// Call-to-action block: an optional heading + a row of buttons. Internal links
// (starting with "/") use client-side navigation; the rest open in a new tab.
export function BlockCta({ block }: { block: ContentBlock }) {
  const links = (block.links ?? []).filter(l => l.label && l.url)
  if (!links.length && !block.title) return null
  return (
    <div className="cta-section block-cta">
      {block.title && <h2>{block.title}</h2>}
      {links.length > 0 && (
        <div className="cta-actions">
          {links.map((l, i) => {
            const cls = i === 0 ? 'btn btn-primary' : 'btn btn-secondary'
            return l.url.startsWith('/')
              ? <Link key={i} to={l.url} className={cls}>{l.label}</Link>
              : <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={cls}>{l.label}</a>
          })}
        </div>
      )}
    </div>
  )
}
