import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { SiteSettings, ContentBlock } from '../../lib/types'

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'heading': return <h2 className="block-heading">{block.text}</h2>
    case 'paragraph': return <p className="block-paragraph">{block.text}</p>
    case 'quote': return <blockquote className="block-quote">{block.text}</blockquote>
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
        <h1>Bakgrund</h1>
        <p>Hur detta initiativ kom till och varför informationen samlas.</p>
      </div>

      {hasBlocks ? (
        <div className="content-blocks" style={{ marginBottom: 'var(--space-9)' }}>
          {blocks.map((block, i) => (
            <ContentBlockRenderer key={i} block={block} />
          ))}
        </div>
      ) : (
        <>
          <section className="background-section">
            <h2>Om Rögleskogen</h2>
            <p>
              Rögleskogen ligger mellan Södra Sandby och Dalby i Lunds kommun. Området används av boende
              för promenader, rekreation och naturupplevelser. Skogen hyser enligt uppgifter från boende
              flera naturvärden och arter.
            </p>
            <p className="text-muted" style={{ marginTop: 'var(--space-3)' }}>
              Observera: Informationen på denna webbplats är exempeldata och ska inte tolkas som
              verifierade fakta utan särskild källhänvisning.
            </p>
          </section>

          <section className="background-section">
            <h2>Varför detta initiativ?</h2>
            <p>
              NCC har informerat om planer på att ansöka om tillstånd för en ny bergtäkt i området.
              Boende har frågor om hur verksamheten kan påverka natur, miljö, hälsa och livsmiljö.
              Detta initiativ samlar information, dokument, vittnesmål och frågor på ett ställe.
            </p>
          </section>

          <div className="principles-grid">
            <section className="principle-card">
              <div className="principle-card-head">
                <span className="principle-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="12" height="16" rx="2" />
                    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
                <h2>Vad vi gör</h2>
              </div>
              <ul className="principle-list">
                <li>Samlar och strukturerar offentlig information om planerna</li>
                <li>Samlar in vittnesmål och observationer från boende</li>
                <li>Sprider information till boende, journalister och beslutsfattare</li>
                <li>Sammanställer frågor och farhågor som väcks av planerna</li>
                <li>Uppmuntrar till saklig och respektfull dialog</li>
              </ul>
            </section>

            <section className="principle-card accent-alt">
              <div className="principle-card-head">
                <span className="principle-card-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </span>
                <h2>Viktiga principer</h2>
              </div>
              <ul className="principle-list">
                <li>All information ska vara saklig och källhänvisad där det är relevant</li>
                <li>Personliga vittnesmål märks tydligt som sådana</li>
                <li>Vi gör inga juridiska eller miljövetenskapliga påståenden utan stöd i publicerade källor</li>
                <li>Initiativet är oberoende och drivs av boende</li>
              </ul>
            </section>
          </div>
        </>
      )}

      <div className="cta-section" style={{ marginTop: 'var(--space-7)' }}>
        <h2>Läs mer</h2>
        <div className="cta-actions">
          <Link to="/amnen" className="btn btn-primary">Ämnesområden</Link>
          <Link to="/dokument" className="btn btn-secondary">Dokument</Link>
          <Link to="/tidslinje" className="btn btn-secondary">Tidslinje</Link>
        </div>
      </div>
    </div>
  )
}
