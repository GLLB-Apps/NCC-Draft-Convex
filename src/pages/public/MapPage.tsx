import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/public/PageHeader'
import type { MapLocation, Testimony } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import MapPreview from '../../components/public/MapPreview'
import TestimonyMap from '../../components/public/TestimonyMap'
import { mapPointTypeLabel, mapPointTypeIcon } from '../../lib/utils'
import { usePage } from '../../lib/usePage'

const COLORS: Record<string, string> = {
  work_area: '#b94a3d',
  quarry_area: '#b94a3d',
  property_border: '#4a6c7f',
  transport_route: '#b8860b',
  residence_distance: '#8b6f47',
  nature_value: '#3d7a52',
  walking_trail: '#2d5a3d',
  observation_point: '#4a6c7f',
  photo_point: '#8b6f47',
  testimony_point: '#2d5a3d',
}

export default function MapPage() {
  const [points, setPoints] = useState<MapLocation[]>([])
  const [testimonies, setTestimonies] = useState<Testimony[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'area' | 'testimonies'>('area')
  const [selectedT, setSelectedT] = useState<string | null>(null)
  const page = usePage('karta')
  const [searchParams] = useSearchParams()

  useEffect(() => {
    Promise.all([
      supabase.from('map_locations').select('*').eq('status', 'published'),
      supabase.from('testimonies').select('*').eq('status', 'approved').order('published_at', { ascending: false }),
    ]).then(([p, t]) => {
      setPoints(p.data as MapLocation[] ?? [])
      setTestimonies((t.data as Testimony[] ?? []).filter(x => x.map_lat != null && x.map_lng != null))
      setLoading(false)
    })
  }, [])

  // Deep link: /karta?vittnesmal=<id> opens the testimony tab and selects it.
  useEffect(() => {
    const id = searchParams.get('vittnesmal')
    if (id) { setTab('testimonies'); setSelectedT(id) }
  }, [searchParams])

  const filteredPoints = activeTypes.size === 0 ? points : points.filter(p => activeTypes.has(p.point_type))

  function toggleType(type: string) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const uniqueTypes = Array.from(new Set(points.map(p => p.point_type)))

  return (
    <div className="container fade-in">
      <div className="page-header">
        <PageHeader slug="karta" />
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'area'} className={tab === 'area' ? 'tab active' : 'tab'} onClick={() => setTab('area')}>Området</button>
        <button role="tab" aria-selected={tab === 'testimonies'} className={tab === 'testimonies' ? 'tab active' : 'tab'} onClick={() => setTab('testimonies')}>
          Vittnesmål{testimonies.length ? ` (${testimonies.length})` : ''}
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"></div></div>
      ) : tab === 'area' ? (
        points.length === 0 ? (
          <div className="empty-state"><p>Inga kartpunkter har publicerats ännu.</p></div>
        ) : (
          <div className="map-layout map-layout-left fade-in">
            {uniqueTypes.length > 0 && (
              <aside className="map-filters">
                <h2 className="map-filters-title">{page.text('layers_heading')}</h2>
                <p className="map-filters-hint">{page.text('layers_hint')}</p>
                {uniqueTypes.map(type => {
                  const active = activeTypes.size === 0 || activeTypes.has(type)
                  const count = points.filter(p => p.point_type === type).length
                  return (
                    <button key={type} className={active ? 'map-filter' : 'map-filter is-off'} onClick={() => toggleType(type)} aria-pressed={active}>
                      <span className="map-filter-icon" style={{ background: COLORS[type] ?? '#2d5a3d' }} aria-hidden="true">{mapPointTypeIcon(type)}</span>
                      <span className="map-filter-label">{mapPointTypeLabel(type)}</span>
                      <span className="map-filter-count">{count}</span>
                    </button>
                  )
                })}
                {activeTypes.size > 0 && (
                  <button className="map-filter-reset" onClick={() => setActiveTypes(new Set())}>Visa alla punkter</button>
                )}
              </aside>
            )}
            <div className="map-container">
              <MapPreview points={filteredPoints} height={520} />
            </div>
          </div>
        )
      ) : (
        testimonies.length === 0 ? (
          <div className="empty-state"><p>Inga vittnesmål med markerad plats ännu.</p></div>
        ) : (
          <div className="testimony-map-layout fade-in">
            <aside className="testimony-list">
              {testimonies.map(t => (
                <button
                  key={t.id}
                  className={selectedT === t.id ? 'testimony-list-item is-active' : 'testimony-list-item'}
                  onClick={() => setSelectedT(t.id)}
                >
                  {t.featured_image && <img src={t.featured_image} alt="" className="testimony-list-thumb" />}
                  <span className="testimony-list-body">
                    <span className="testimony-list-title">{t.title || (t.is_anonymous ? 'Anonym' : t.author_name || 'Vittnesmål')}</span>
                    <span className="testimony-list-snippet">{t.story.length > 90 ? t.story.slice(0, 90) + '…' : t.story}</span>
                    {t.location && <span className="testimony-list-loc">{t.location}</span>}
                  </span>
                </button>
              ))}
            </aside>
            <div className="testimony-map">
              <TestimonyMap testimonies={testimonies} selectedId={selectedT} onSelect={setSelectedT} height={520} />
            </div>
          </div>
        )
      )}
    </div>
  )
}
