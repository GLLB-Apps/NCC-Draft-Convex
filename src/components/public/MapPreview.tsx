import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapLocation, MapArea } from '../../lib/types'
import { mapPointTypeLabel, distanceMeters, formatDistance, MAP_FIT_PADDING, areaBounds } from '../../lib/utils'

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

interface Props {
  points: MapLocation[]
  /** Områdespolygoner som ska ritas. Redan filtrerade av anroparen. */
  areas?: MapArea[]
  height?: number
}

export default function MapPreview({ points, areas = [], height = 350 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  // Punkter och områden hålls i egna lagergrupper så att uppdatering av det ena
  // inte rensar bort det andra (L.Polygon ärver från L.Polyline).
  const pointLayerRef = useRef<L.LayerGroup | null>(null)
  const areaLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: points[0] ? [points[0].lat, points[0].lng] : [55.72, 13.32],
      zoom: 13,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    mapRef.current = map
    areaLayerRef.current = L.layerGroup().addTo(map)
    pointLayerRef.current = L.layerGroup().addTo(map)

    // Utsnitt: visa samtliga områden vid start, oavsett vilka lager som är på.
    const fit = areaBounds(areas)
    if (fit.length) map.fitBounds(L.latLngBounds(fit), { padding: MAP_FIT_PADDING })

    return () => {
      map.remove()
      mapRef.current = null
      pointLayerRef.current = null
      areaLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    const group = areaLayerRef.current
    if (!group) return
    group.clearLayers()

    areas.forEach(area => {
      if (area.points.length < 3) return
      L.polygon(area.points, {
        color: area.color,
        weight: 3,
        dashArray: area.line_style === 'dashed' ? '8 6' : undefined,
        opacity: 0.95,
        fillColor: area.color,
        fillOpacity: area.fill_opacity,
      })
        .bindTooltip(area.title, { sticky: true })
        .bindPopup(`
          <strong>${area.title}</strong>
          ${area.description ? `<br/><span style="font-size:0.85rem;">${area.description}</span>` : ''}
        `)
        .addTo(group)
    })
  }, [areas])

  useEffect(() => {
    const map = mapRef.current
    const group = pointLayerRef.current
    if (!map || !group) return

    group.clearLayers()

    // Reference point(s) for "distance to residence": nearest quarry/work area.
    const quarryPoints = points.filter(p => p.point_type === 'quarry_area' || p.point_type === 'work_area')
    const nearestQuarry = (p: MapLocation) => {
      let best: MapLocation | null = null
      let bestDist = Infinity
      for (const q of quarryPoints) {
        const d = distanceMeters(p.lat, p.lng, q.lat, q.lng)
        if (d < bestDist) { bestDist = d; best = q }
      }
      return best ? { point: best, dist: bestDist } : null
    }

    points.forEach(point => {
      const color = COLORS[point.point_type] ?? '#2d5a3d'
      const icon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })

      // Distance line from a residence point to the nearest planned quarry area.
      let distanceNote = ''
      if (point.point_type === 'residence_distance') {
        const nq = nearestQuarry(point)
        if (nq) {
          distanceNote = `<br/><strong style="font-size:0.85rem;color:#b94a3d;">≈ ${formatDistance(nq.dist)} till planerat täktområde</strong>`
          L.polyline([[point.lat, point.lng], [nq.point.lat, nq.point.lng]], {
            color: '#b94a3d', weight: 2, dashArray: '6 6', opacity: 0.75,
          })
            .addTo(group)
            .bindTooltip(`≈ ${formatDistance(nq.dist)} till planerat täktområde`, { sticky: true })
        }
      }

      const marker = L.marker([point.lat, point.lng], { icon }).addTo(group)
      marker.bindPopup(`
        <strong>${point.title}</strong><br/>
        <span style="font-size:0.85rem;color:#666;">${mapPointTypeLabel(point.point_type)}</span>
        ${point.description ? `<br/><span style="font-size:0.85rem;">${point.description}</span>` : ''}
        ${distanceNote}
      `)
    })
  }, [points])

  return <div ref={containerRef} style={{ height, borderRadius: 'var(--radius-lg)' }} />
}
