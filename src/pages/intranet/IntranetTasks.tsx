import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import type { IntranetTask } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { useToast } from '../../lib/toast'
import { useConfirm } from '../../lib/confirm'
import { useMarkIntranetRead } from '../../lib/intranetNotifications'

// Delade uppgiftslistor. Poster grupperas på fältet "list"; avklarade hamnar
// längst ned inom sin grupp. Vem som helst i intranätet kan bocka av och lägga till.
const UNGROUPED = 'Att göra'

export default function IntranetTasks() {
  const { user, isAdmin } = useAuth()
  const { show } = useToast()
  const { confirm } = useConfirm()
  const [tasks, setTasks] = useState<IntranetTask[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [list, setList] = useState('')
  useMarkIntranetRead('tasks', !loading)

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    supabase.from('intranet_tasks').select('*').order('created_at', { ascending: true }).then(({ data }) => {
      setTasks((data as IntranetTask[]) ?? [])
      setLoading(false)
    })
  }

  const lists = useMemo(() => Array.from(new Set(tasks.map(t => t.list).filter(Boolean))) as string[], [tasks])

  // Gruppera per lista, avklarade sist inom gruppen.
  const grouped = useMemo(() => {
    const map = new Map<string, IntranetTask[]>()
    for (const t of tasks) {
      const key = t.list || UNGROUPED
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.done) - Number(b.done) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }
    return Array.from(map.entries())
  }, [tasks])

  async function add() {
    if (!text.trim()) return
    const { error } = await supabase.from('intranet_tasks').insert({
      text: text.trim(),
      list: list.trim() || null,
      done: false,
      created_by: user?.id ?? null,
    })
    if (error) { show('Kunde inte lägga till: ' + error.message, 'error'); return }
    setText(''); load()
  }

  async function toggle(t: IntranetTask) {
    const done = !t.done
    // Optimistisk uppdatering så avbockningen känns direkt.
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done } : x))
    const { error } = await supabase.from('intranet_tasks').update({
      done, done_by: done ? (user?.email ?? null) : null,
    }).eq('id', t.id)
    if (error) { show('Kunde inte spara: ' + error.message, 'error'); load() }
  }

  async function remove(t: IntranetTask) {
    if (!(await confirm({ message: 'Ta bort uppgiften?', confirmText: 'Ta bort', danger: true }))) return
    const { error } = await supabase.from('intranet_tasks').delete().eq('id', t.id)
    if (error) { show('Kunde inte ta bort: ' + error.message, 'error'); return }
    setTasks(prev => prev.filter(x => x.id !== t.id))
  }

  const canRemove = (t: IntranetTask) => t.created_by === user?.id || isAdmin

  if (loading) return <div className="loading"><div className="spinner"></div></div>

  return (
    <div className="fade-in">
      <div className="admin-page-header">
        <h1>Uppgifter</h1>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="intranet-task-add">
          <input
            className="form-input"
            placeholder="Ny uppgift…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
          />
          <input
            className="form-input intranet-task-list-input"
            list="task-lists"
            placeholder="Lista (valfritt)"
            value={list}
            onChange={e => setList(e.target.value)}
          />
          <datalist id="task-lists">{lists.map(l => <option key={l} value={l} />)}</datalist>
          <button className="btn btn-primary" onClick={add}><Plus size={16} /> Lägg till</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state"><p>Inga uppgifter ännu.</p></div>
      ) : (
        grouped.map(([name, items]) => {
          const openCount = items.filter(t => !t.done).length
          return (
            <section key={name} className="intranet-task-group">
              <h2 className="intranet-task-group-title">{name} <span className="intranet-task-count">{openCount} kvar</span></h2>
              <ul className="intranet-task-list">
                {items.map(t => (
                  <li key={t.id} className={t.done ? 'intranet-task is-done' : 'intranet-task'}>
                    <button className="intranet-task-check" onClick={() => toggle(t)} aria-pressed={t.done} aria-label={t.done ? 'Markera som ej klar' : 'Markera som klar'}>
                      {t.done && <Check size={14} aria-hidden="true" />}
                    </button>
                    <span className="intranet-task-text">{t.text}</span>
                    {t.done && t.done_by && <span className="intranet-task-by">{t.done_by}</span>}
                    {canRemove(t) && (
                      <button className="intdoc-icon-btn danger intranet-task-remove" title="Ta bort" onClick={() => remove(t)}><Trash2 size={14} /></button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}
