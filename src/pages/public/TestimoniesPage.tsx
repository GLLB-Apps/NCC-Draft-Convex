import { useEffect, useState } from 'react'
import type { Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import TestimonyForm from '../../components/public/TestimonyForm'
import { usePage } from '../../lib/usePage'

export default function TestimoniesPage() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const page = usePage('vittnesmal')

  useEffect(() => {
    supabase
      .from('testimonies')
      .select('*')
      .eq('status', 'approved')
      .order('published_at', { ascending: false })
      .then(({ data }) => {
        setTestimonies(data as Testimony[] ?? [])
        setLoading(false)
      })
  }, [])

  async function handleSubmit(data: Record<string, unknown>) {
    const { error } = await supabase.from('testimonies').insert({
      title: data.title,
      story: data.story,
      author_name: data.author_name,
      is_anonymous: data.is_anonymous,
      email: data.email,
      location: data.location,
      area_usage: data.area_usage,
      consent_publish: data.consent_publish,
      consent_contact: data.consent_contact,
      status: 'pending',
    })
    if (error) {
      show('Något gick fel. Försök igen senare.', 'error')
    } else {
      show(page.text('success'), 'success')
    }
  }

  return (
    <div className="container fade-in">
      <div className="page-header">
        <h1>{page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>

      <section style={{ marginBottom: 'var(--space-9)' }}>
        <h2 style={{ marginBottom: 'var(--space-5)' }}>{page.text('list_heading')}</h2>
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : testimonies.length === 0 ? (
          <div className="empty-state">
            <p>Inga vittnesmål har publicerats ännu.</p>
          </div>
        ) : (
          <div className="grid grid-2">
            {testimonies.map(t => (
              <div key={t.id} className="testimony-card">
                {t.featured_image && (
                  <img src={t.featured_image} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                )}
                {t.title && <h3>{t.title}</h3>}
                <p className="testimony-quote">"{t.story}"</p>
                <p className="testimony-author">
                  {t.is_anonymous ? 'Anonym' : t.author_name ?? 'Anonym'}
                  {t.location && `, ${t.location}`}
                </p>
                {t.area_usage && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Användning: {t.area_usage}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ marginBottom: 'var(--space-9)' }}>
        <h2 style={{ marginBottom: 'var(--space-3)' }}>{page.text('form_heading')}</h2>
        <p className="text-muted" style={{ marginBottom: 'var(--space-5)' }}>
          {page.text('form_intro')}
        </p>
        <TestimonyForm onSubmit={handleSubmit} />
      </section>
    </div>
  )
}
