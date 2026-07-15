import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import type { SiteSettings, Topic, Post } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { formatDate, formatDateShort, truncate } from '../../lib/utils'
import TopicIcon from '../../components/public/TopicIcon'

export default function HomePage() {
  const { settings } = useOutletContext<{ settings: SiteSettings | null }>()
  const [topics, setTopics] = useState<Topic[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('topics').select('*').eq('status', 'published').order('sort_order').limit(6),
      supabase.from('posts').select('*').eq('status', 'published').order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(3),
    ]).then(([t, p]) => {
      setTopics(t.data as Topic[] ?? [])
      setPosts(p.data as Post[] ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      {/* Hero / översikt */}
      <section className="hero">
        {settings?.hero_image && (
          <div className="hero-bg" style={{ backgroundImage: `url(${settings.hero_image})` }} />
        )}
        <div className="hero-content">
          <h1>{settings?.hero_title ?? 'Ett nytt stenbrott planeras i Rögleskogen'}</h1>
          <p className="hero-intro">{settings?.hero_intro}</p>
          <div className="hero-actions">
            <Link to="/amnen" className="btn btn-primary">Läs om planerna</Link>
            <a href={settings?.petition_url ?? '#'} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">Skriv under</a>
            <Link to="/karta" className="btn btn-secondary">Se området på karta</Link>
          </div>
        </div>
      </section>

      {/* Status */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2>Aktuell status</h2>
            <p>Översikt över var i processen vi befinner oss.</p>
          </div>
          <div className="status-card">
            <div className="status-item">
              <span className="status-label">Aktuell fas</span>
              <span className="status-value">{settings?.status_phase ?? 'Informations- och samrådsskedet'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Nästa viktiga datum</span>
              <span className="status-value">{settings?.next_important_date ? formatDate(settings.next_important_date) : 'Ännu ej fastställt'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Senast uppdaterad</span>
              <span className="status-value">{formatDate(new Date().toISOString())}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Underskrifter</span>
              <span className="status-value">{settings?.signature_count ?? 0}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Namninsamling</span>
              <a href={settings?.petition_url ?? '#'} target="_blank" rel="noopener noreferrer" className="status-value" style={{ color: 'var(--primary)' }}>
                Skrivunder.com →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Sammanfattning */}
      <section className="section" style={{ background: 'var(--bg-alt)' }}>
        <div className="container">
          <div className="section-header">
            <h2>Kort sammanfattning</h2>
          </div>
          <div className="grid grid-3">
            <div className="card">
              <h3>Vad planeras?</h3>
              <p className="text-muted">NCC har informerat om planer på att ansöka om tillstånd för en ny bergtäkt i Rögleskogen mellan Södra Sandby och Dalby i Lunds kommun.</p>
            </div>
            <div className="card">
              <h3>Varför väcker det frågor?</h3>
              <p className="text-muted">Boende och naturintresserade har frågor om buller, damm, trafik, naturvärden och påverkan på närmiljö och livsmiljö.</p>
            </div>
            <div className="card">
              <h3>Vad händer nu?</h3>
              <p className="text-muted">Processen befinner sig i ett tidigt skede. Information samlas här kontinuerligt. Håll dig uppdaterad via tidslinjen och nyheterna.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ämnesområden */}
      {topics.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2>Ämnesområden</h2>
              <p>Utforska olika aspekter av den planerade bergtäkten.</p>
            </div>
            <div className="grid grid-3">
              {topics.map(topic => (
                <Link key={topic.id} to={`/amnen/${topic.slug}`} className="card card-clickable topic-card">
                  <div className="topic-card-icon">
                    {topic.featured_image ? (
                      <img src={topic.featured_image} alt="" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
                    ) : (
                      <TopicIcon slug={topic.slug} />
                    )}
                  </div>
                  <h3>{topic.title}</h3>
                  {topic.intro && <p>{truncate(topic.intro, 100)}</p>}
                </Link>
              ))}
            </div>
            <Link to="/amnen" className="section-link">Alla ämnen →</Link>
          </div>
        </section>
      )}

      {/* Senaste nytt */}
      {posts.length > 0 && (
        <section className="section" style={{ background: 'var(--bg-alt)' }}>
          <div className="container">
            <div className="section-header">
              <h2>Senaste nytt</h2>
            </div>
            <div className="grid grid-3">
              {posts.map(post => (
                <Link key={post.id} to={`/nyheter/${post.slug}`} className="card card-clickable news-card">
                  {post.featured_image && (
                    <img src={post.featured_image} alt="" className="news-card-image" />
                  )}
                  <span className="news-card-date">{formatDateShort(post.published_at)}</span>
                  <h3>{post.title}</h3>
                  {post.excerpt && <p>{truncate(post.excerpt, 120)}</p>}
                </Link>
              ))}
            </div>
            <Link to="/nyheter" className="section-link">Fler nyheter →</Link>
          </div>
        </section>
      )}

      {/* Hjälp till / CTA */}
      <section className="section">
        <div className="container">
          <div className="cta-section">
            <h2>Hjälp till att sprida informationen</h2>
            <p className="text-muted">Skriv under namninsamlingen, dela informationen eller lämna ditt vittnesmål.</p>
            <div className="cta-actions">
              <a href={settings?.petition_url ?? '#'} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Skriv under</a>
              <Link to="/vittnesmal" className="btn btn-secondary">Lämna ett vittnesmål</Link>
              <Link to="/kontakt" className="btn btn-secondary">Kontakta initiativet</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
