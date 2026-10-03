import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { convexClient } from '../../lib/convexClient'
import { api } from '../../../convex/_generated/api'
import { useToast } from '../../lib/toast'
import TestimonyForm from '../../components/public/TestimonyForm'
import AvatarFacepile from '../../components/AvatarFacepile'
import UserAvatar from '../../components/UserAvatar'
import { usePage } from '../../lib/usePage'
import { truncate, testimonyBlobSeed } from '../../lib/utils'
import { randomRogleTitle } from '../../lib/rogleTitles'
import { takeRogleHandoff } from '../../lib/rogleHandoff'

export default function TestimoniesPage() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  // Kommer man hit från startsidans teaser hoppar man direkt till formuläret
  // — teasern lämnar alltid en slumpad titel, och ett namn om man skrev ett.
  // Läses (och rensas) en gång vid mount, inte i en useSearchParams-URL.
  const [handoff] = useState(takeRogleHandoff)
  const prefillName = handoff?.name ?? ''
  const prefillTitle = handoff?.title ?? ''
  const [tab, setTab] = useState<'published' | 'submit'>(prefillTitle || prefillName ? 'submit' : 'published')
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
    // sparas i testimonyContacts, inte här. Ett godkänt vittnesmål är publikt
    // läsbart i sin helhet, och Convex kan inte skydda enskilda fält.
    //
    // submit() skriver vittnesmålet + kontaktuppgifterna atomiskt i en
    // transaktion (en förbättring jämfört med de två sekventiella inserts
    // Appwrite-/PHP-versionerna gjorde — se MIGRATION_PLAN.md §2).
    const anonym = data.is_anonymous === true
    try {
      await convexClient.mutation(api.testimonies.submit, {
        title: (data.title as string | undefined) || undefined,
        story: data.story as string,
        is_anonymous: Boolean(data.is_anonymous),
        location: (data.location as string | undefined) || undefined,
        area_usage: (data.area_usage as string | undefined) || undefined,
        featured_image: (data.featured_image as string | undefined) || undefined,
        map_lat: (data.map_lat as number | undefined) ?? undefined,
        map_lng: (data.map_lng as number | undefined) ?? undefined,
        consent_publish: Boolean(data.consent_publish),
        consent_contact: Boolean(data.consent_contact),
        consent_marketing: Boolean(data.consent_marketing),
        contact_email: (data.email as string | undefined) || undefined,
        contact_author_name: anonym ? undefined : ((data.author_name as string | undefined) || undefined),
      })
    } catch {
      show('Något gick fel. Försök igen senare.', 'error')
      return
    }

    show(`${page.text('success')} Du är nu en ${randomRogleTitle()}!`, 'success')
  }

  return (
    <div className="container fade-in">
      <div className="page-header">
        <div className="page-title-row">
          <h1>{page.title}</h1>
          <AvatarFacepile seeds={testimonies.map(t => testimonyBlobSeed(t.author_name ?? '', t.story, t.is_anonymous))} />
        </div>
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
              <Link key={t.id} to={`/vittnesmal/${t.id}`} className="testimony-card">
                {t.featured_image && (
                  <img src={t.featured_image} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                )}
                {t.title && <h3>{t.title}</h3>}
                <p className="testimony-quote">"{truncate(t.story, 200)}"</p>
                <div className="testimony-card-author">
                  <UserAvatar seed={testimonyBlobSeed(t.author_name ?? '', t.story, t.is_anonymous)} size={32} />
                  <p className="testimony-author">
                    {t.is_anonymous ? 'Anonym' : t.author_name ?? 'Anonym'}
                    {t.location && `, ${t.location}`}
                  </p>
                </div>
                {t.area_usage && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Användning: {t.area_usage}</p>}
              </Link>
            ))}
          </div>
        )}
      </section>
      ) : (
      <section className="fade-in" style={{ marginBottom: 'var(--space-9)' }}>
        <p className="text-muted" style={{ marginBottom: 'var(--space-5)', maxWidth: '60ch' }}>
          {page.text('form_intro')}
        </p>
        <TestimonyForm onSubmit={handleSubmit} initialName={prefillName} initialTitleWord={prefillTitle} />
      </section>
      )}
    </div>
  )
}
