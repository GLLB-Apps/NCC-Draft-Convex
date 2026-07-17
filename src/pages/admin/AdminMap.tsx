import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MapLocation } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { mapPointTypeLabel, statusLabel, statusBadgeClass } from '../../lib/utils'

export default function AdminMap() {
  const [points, setPoints] = useState<MapLocation[]>([])
  const [loading, setLoading] = useState(true)
  const { show } = useToast()
  const { confirm } = useConfirm()

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    supabase.from('map_locations').select('*').order('updated_at', { ascending: false }).then(({ data }) => {
      setPoints(data as MapLocation[] ?? [])
      setLoading(false)
    })
  }

  async function remove(id: string) {
    if (!(await confirm({ message: 'Ta bort denna kartpunkt?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('map_locations').delete().eq('id', id)
    if (error) show('Kunde inte ta bort: ' + error.message, 'error')
    else { show('Kartpunkt borttagen', 'success'); load() }
  }

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Kartpunkter</h1>
        <Link to="/admin/karta/ny" className="btn btn-primary btn-sm">Ny kartpunkt</Link>
      </div>
      {points.length === 0 ? (
        <div className="empty-state"><p>Inga kartpunkter finns ännu.</p></div>
      ) : (
        <div className="admin-list">
          {points.map(p => (
            <div key={p.id} className="admin-list-item">
              <div className="admin-list-item-info">
                <div className="admin-list-item-title">{p.title}</div>
                <div className="admin-list-item-meta">
                  <span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span>
                  <span>{mapPointTypeLabel(p.point_type)}</span>
                  <span>{p.lat.toFixed(4)}, {p.lng.toFixed(4)}</span>
                </div>
              </div>
              <div className="admin-table-actions">
                <Link to={`/admin/karta/${p.id}`} className="btn btn-secondary btn-sm">Redigera</Link>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>Ta bort</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
