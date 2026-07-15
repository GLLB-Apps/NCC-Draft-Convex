import { useEffect, useState } from 'react'
import type { SiteSettings } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'

export default function AdminSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    supabase.from('site_settings').select('*').maybeSingle().then(({ data }) => {
      setSettings(data as SiteSettings | null)
      setLoading(false)
    })
  }, [])

  function update(key: keyof SiteSettings, value: string | number | Record<string, string> | null) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function save() {
    if (!settings) return
    setSaving(true)
    const { error } = await supabase.from('site_settings').update({
      site_name: settings.site_name,
      site_subtitle: settings.site_subtitle,
      logo_url: settings.logo_url,
      favicon_url: settings.favicon_url,
      petition_url: settings.petition_url,
      default_share_image: settings.default_share_image,
      contact_email: settings.contact_email,
      contact_phone: settings.contact_phone,
      social_links: settings.social_links,
      footer_text: settings.footer_text,
      privacy_text: settings.privacy_text,
      cookie_text: settings.cookie_text,
      status_message: settings.status_message,
      status_phase: settings.status_phase,
      next_important_date: settings.next_important_date,
      signature_count: settings.signature_count,
      hero_title: settings.hero_title,
      hero_intro: settings.hero_intro,
      hero_image: settings.hero_image,
    }).eq('id', settings.id)
    setSaving(false)
    if (error) show('Kunde inte spara: ' + error.message, 'error')
    else show('Inställningar sparade', 'success')
  }

  async function syncSignatures() {
    try {
      const r = await fetch('/api/sync-signatures')
      const j = await r.json()
      if (r.ok && typeof j.count === 'number') {
        update('signature_count', j.count)
        show(`Hämtade ${j.count} underskrifter från Skrivunder`, 'success')
      } else {
        show('Kunde inte hämta: ' + (j.error ?? r.status), 'error')
      }
    } catch {
      show('Kunde inte hämta (fungerar bara i den publicerade versionen)', 'error')
    }
  }

  if (loading || !settings) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Webbplatsinställningar</h1>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
      </div>

      <div className="admin-form-card">
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Allmänt</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="site_name">Webbplatsens namn</label>
          <input id="site_name" className="form-input" type="text" value={settings.site_name} onChange={e => update('site_name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="site_subtitle">Undertitel</label>
          <input id="site_subtitle" className="form-input" type="text" value={settings.site_subtitle} onChange={e => update('site_subtitle', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="logo_url">Logotyp (URL)</label>
            <input id="logo_url" className="form-input" type="url" value={settings.logo_url ?? ''} onChange={e => update('logo_url', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="favicon_url">Favicon (URL)</label>
            <input id="favicon_url" className="form-input" type="url" value={settings.favicon_url ?? ''} onChange={e => update('favicon_url', e.target.value || null)} />
          </div>
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Startsida</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="hero_title">Hero-rubrik</label>
          <input id="hero_title" className="form-input" type="text" value={settings.hero_title} onChange={e => update('hero_title', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="hero_intro">Hero-ingress</label>
          <textarea id="hero_intro" className="form-textarea" rows={3} value={settings.hero_intro} onChange={e => update('hero_intro', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="hero_image">Hero-bild (URL)</label>
          <input id="hero_image" className="form-input" type="url" value={settings.hero_image ?? ''} onChange={e => update('hero_image', e.target.value || null)} />
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Aktuell status</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="status_message">Statusmeddelande</label>
          <input id="status_message" className="form-input" type="text" value={settings.status_message ?? ''} onChange={e => update('status_message', e.target.value || null)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="status_phase">Aktuell fas</label>
          <input id="status_phase" className="form-input" type="text" value={settings.status_phase ?? ''} onChange={e => update('status_phase', e.target.value || null)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="next_important_date">Nästa viktiga datum</label>
            <input id="next_important_date" className="form-input" type="date" value={settings.next_important_date ?? ''} onChange={e => update('next_important_date', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signature_count">Antal underskrifter</label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input id="signature_count" className="form-input" type="number" value={settings.signature_count} onChange={e => update('signature_count', Number(e.target.value))} />
              <button type="button" className="btn btn-secondary" style={{ flexShrink: 0 }} onClick={syncSignatures}>Hämta från Skrivunder</button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 'var(--space-2)' }}>
              Hämtas automatiskt en gång per dygn från kampanjsidan. Knappen uppdaterar direkt (fungerar i den publicerade versionen).
            </p>
          </div>
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Kontakt och länkar</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="petition_url">Länk till namninsamling</label>
          <input id="petition_url" className="form-input" type="url" value={settings.petition_url} onChange={e => update('petition_url', e.target.value)} />
        </div>
        <div className="grid grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="contact_email">Kontakt-e-post</label>
            <input id="contact_email" className="form-input" type="email" value={settings.contact_email ?? ''} onChange={e => update('contact_email', e.target.value || null)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="contact_phone">Kontakt-telefon</label>
            <input id="contact_phone" className="form-input" type="tel" value={settings.contact_phone ?? ''} onChange={e => update('contact_phone', e.target.value || null)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="default_share_image">Standardbild för delning (URL)</label>
          <input id="default_share_image" className="form-input" type="url" value={settings.default_share_image ?? ''} onChange={e => update('default_share_image', e.target.value || null)} />
        </div>
      </div>

      <div className="admin-form-card" style={{ marginTop: 'var(--space-5)' }}>
        <h3 style={{ marginBottom: 'var(--space-5)' }}>Texter</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="footer_text">Sidfot</label>
          <textarea id="footer_text" className="form-textarea" rows={2} value={settings.footer_text ?? ''} onChange={e => update('footer_text', e.target.value || null)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="privacy_text">Integritetstext</label>
          <textarea id="privacy_text" className="form-textarea" rows={3} value={settings.privacy_text ?? ''} onChange={e => update('privacy_text', e.target.value || null)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="cookie_text">Cookie-information</label>
          <textarea id="cookie_text" className="form-textarea" rows={2} value={settings.cookie_text ?? ''} onChange={e => update('cookie_text', e.target.value || null)} />
        </div>
      </div>

      <div className="admin-form-actions" style={{ marginTop: 'var(--space-5)' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara alla inställningar'}</button>
      </div>
    </div>
  )
}
