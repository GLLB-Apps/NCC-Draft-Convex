import { useEffect, useState } from 'react'
import type { Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import TestimonyForm from '../../components/public/TestimonyForm'
import { usePage } from '../../lib/usePage'

export default function TestimoniesPage() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'published' | 'submit'>('published')
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
    // E-posten, den interna anteckningen och namnet på anonyma vittnesmål
    // sparas i testimony_contacts, inte här. Ett godkänt vittnesmål är publikt
    // läsbart i sin helhet, och Appwrite kan inte skydda enskilda fält.
    const anonym = data.is_anonymous === true
    const { data: created, error } = await supabase.from('testimonies').insert({
      title: data.title,
      story: data.story,
      author_name: anonym ? null : data.author_name,
      is_anonymous: data.is_anonymous,
      location: data.location,
      area_usage: data.area_usage,
      featured_image: data.featured_image || null,
      map_lat: data.map_lat ?? null,
      map_lng: data.map_lng ?? null,
      consent_publish: data.consent_publish,
      consent_contact: data.consent_contact,
      consent_marketing: data.consent_marketing,
      status: 'pending',
    })
    if (error) {
      show('Något gick fel. Försök igen senare.', 'error')
      return
    }

    // Kontaktuppgifterna i sin egen, adminskyddade kollektion. Misslyckas den
    // här skrivningen är vittnesmålet ändå inne — berättelsen är det viktiga,
    // och redaktionen kan höra av sig via en annan väg. Besökaren ska inte få
    // ett felmeddelande om något som redan gått igenom.
    const id = (created as { id?: string } | null)?.id
    if (id) {
      await supabase.from('testimony_contacts').insert({
        testimony_id: id,
        email: data.email || null,
        author_name: data.author_name || null,
      })
    }

    show(page.text('success'), 'success')
  }

  return (
    <div className="container fade-in">
      <div className="page-header">
        <h1>{page.title}</h1>
        {page.intro && <p>{page.intro}</p>}
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'published'} className={tab === 'published' ? 'tab active' : 'tab'} onClick={() => setTab('published')}>
          {page.text('list_heading')}
        </button>
        <button role="tab" aria-selected={tab === 'submit'} className={tab === 'submit' ? 'tab active' : 'tab'} onClick={() => setTab('submit')}>
          {page.text('form_heading')}
        </button>
      </div>

      {tab === 'published' ? (
      <section className="fade-in" style={{ marginBottom: 'var(--space-9)' }}>
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
      ) : (
      <section className="fade-in" style={{ marginBottom: 'var(--space-9)' }}>
        <p className="text-muted" style={{ marginBottom: 'var(--space-5)', maxWidth: '60ch' }}>
          {page.text('form_intro')}
        </p>
        <TestimonyForm onSubmit={handleSubmit} />
      </section>
      )}
    </div>
  )
}
