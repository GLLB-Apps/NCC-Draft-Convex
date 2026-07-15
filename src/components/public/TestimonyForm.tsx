import { useState } from 'react'
import { usePage } from '../../lib/usePage'
interface TestimonyFormProps {
  onSubmit: (data: Record<string, unknown>) => Promise<void>
}

export default function TestimonyForm({ onSubmit }: TestimonyFormProps) {
  const page = usePage('vittnesmal')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    title: '',
    story: '',
    author_name: '',
    is_anonymous: false,
    email: '',
    location: '',
    area_usage: '',
    consent_publish: false,
    consent_contact: false,
    website: '',
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!form.story.trim()) e.story = 'Berättelse är obligatorisk'
    if (!form.email.trim()) e.email = 'E-post är obligatorisk'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ogiltig e-postadress'
    if (!form.consent_publish) e.consent_publish = 'Du måste godkänna behandling och publicering'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (form.website) return
    if (!validate()) return
    setSubmitting(true)
    await onSubmit(form)
    setSubmitting(false)
    setForm({
      title: '', story: '', author_name: '', is_anonymous: false,
      email: '', location: '', area_usage: '',
      consent_publish: false, consent_contact: false, website: '',
    })
  }

  function update(key: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <div className="form-group">
        <label className="form-label" htmlFor="title">{page.text('label_title')}</label>
        <input
          id="title"
          className="form-input"
          type="text"
          value={form.title}
          onChange={e => update('title', e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="story">{page.text('label_story')} *</label>
        <textarea
          id="story"
          className="form-textarea"
          rows={6}
          value={form.story}
          onChange={e => update('story', e.target.value)}
          aria-invalid={!!errors.story}
        />
        {errors.story && <p className="form-error">{errors.story}</p>}
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="area_usage">{page.text('label_area')}</label>
        <input
          id="area_usage"
          className="form-input"
          type="text"
          placeholder="T.ex. promenader, hundrastning, naturupplevelser"
          value={form.area_usage}
          onChange={e => update('area_usage', e.target.value)}
        />
      </div>

      <div className="grid grid-2">
        <div className="form-group">
          <label className="form-label" htmlFor="author_name">{page.text('label_name')}</label>
          <input
            id="author_name"
            className="form-input"
            type="text"
            value={form.author_name}
            onChange={e => update('author_name', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="location">{page.text('label_location')}</label>
          <input
            id="location"
            className="form-input"
            type="text"
            placeholder="T.ex. Södra Sandby"
            value={form.location}
            onChange={e => update('location', e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="email">{page.text('label_email')} *</label>
        <input
          id="email"
          className="form-input"
          type="email"
          value={form.email}
          onChange={e => update('email', e.target.value)}
          aria-invalid={!!errors.email}
        />
        {errors.email ? <p className="form-error">{errors.email}</p> : <p className="form-hint">{page.text('email_hint')}</p>}
      </div>

      <div className="checkbox-group">
        <input
          id="is_anonymous"
          type="checkbox"
          checked={form.is_anonymous}
          onChange={e => update('is_anonymous', e.target.checked)}
        />
        <label htmlFor="is_anonymous" className="form-label" style={{ margin: 0 }}>
          {page.text('anonymous')}
        </label>
      </div>

      <div className="checkbox-group">
        <input
          id="consent_publish"
          type="checkbox"
          checked={form.consent_publish}
          onChange={e => update('consent_publish', e.target.checked)}
          aria-invalid={!!errors.consent_publish}
        />
        <label htmlFor="consent_publish" className="form-label" style={{ margin: 0 }}>
          {page.text('consent_publish')} *
        </label>
      </div>
      {errors.consent_publish && <p className="form-error">{errors.consent_publish}</p>}

      <div className="checkbox-group">
        <input
          id="consent_contact"
          type="checkbox"
          checked={form.consent_contact}
          onChange={e => update('consent_contact', e.target.checked)}
        />
        <label htmlFor="consent_contact" className="form-label" style={{ margin: 0 }}>
          {page.text('consent_contact')}
        </label>
      </div>

      {/* Honeypot */}
      <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
        <label htmlFor="website">Lämna tomt</label>
        <input id="website" type="text" value={form.website} onChange={e => update('website', e.target.value)} tabIndex={-1} autoComplete="off" />
      </div>

      <p className="form-hint" style={{ marginBottom: 'var(--space-4)' }}>
        {page.text('review_hint')}
      </p>

      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? 'Skickar…' : page.text('submit')}
      </button>
    </form>
  )
}
