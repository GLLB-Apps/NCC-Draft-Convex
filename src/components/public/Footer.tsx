import { Link } from 'react-router-dom'
import type { SiteSettings } from '../../lib/types'

export default function Footer({ settings }: { settings: SiteSettings | null }) {
  const petition = settings?.petition_url ?? '#'
  const social = settings?.social_links ? Object.entries(settings.social_links) : []

  return (
    <footer className="site-footer">
      {/* Call to action band */}
      <div className="footer-cta">
        <div className="container footer-cta-inner">
          <div>
            <h3>Var med och gör skillnad</h3>
            <p>Skriv under namninsamlingen och håll dig uppdaterad om planerna för Rögleskogen.</p>
          </div>
          <a href={petition} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Skriv under namninsamlingen
          </a>
        </div>
      </div>

      <div className="container footer-inner">
        <div className="footer-col footer-col-brand">
          <h3 className="footer-title">{settings?.site_name ?? 'Rögleskogen'}</h3>
          <p className="footer-subtitle">{settings?.site_subtitle}</p>
          <p className="footer-text">
            {settings?.footer_text ??
              'Ett oberoende medborgarinitiativ som samlar information, dokument och vittnesmål om den planerade bergtäkten mellan Södra Sandby och Dalby.'}
          </p>
          {social.length > 0 && (
            <div className="footer-social">
              {social.map(([key, url]) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="footer-social-link">
                  {key}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Engagera dig</h4>
          <ul className="footer-links">
            <li><a href={petition} target="_blank" rel="noopener noreferrer">Skriv under</a></li>
            <li><Link to="/vittnesmal">Lämna ett vittnesmål</Link></li>
            <li><Link to="/kontakt">Kontakta initiativet</Link></li>
            <li><Link to="/fragor-och-svar">Vanliga frågor</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4 className="footer-heading">Kontakt</h4>
          {settings?.contact_email && (
            <p className="footer-contact">
              <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
            </p>
          )}
          {settings?.contact_phone && <p className="footer-contact">{settings.contact_phone}</p>}
          <p className="footer-text" style={{ marginTop: 'var(--space-3)' }}>
            Har du tips, bilder eller frågor? Hör gärna av dig.
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <p className="footer-copyright">
            © {new Date().getFullYear()} {settings?.site_name ?? 'Rögleskogen'}. Exempeldata — inte verifierade fakta utan källhänvisning.
          </p>
          <div className="footer-bottom-links">
            <button
              type="button"
              className="footer-to-top"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Till toppen ↑
            </button>
            <Link to="/admin" className="footer-admin-link">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
