// Reusable searchable Lucide icon picker, used wherever the admin chooses an
// icon (menu editor, topics, …). Value is a Lucide icon name (kebab-case).
import { useEffect, useMemo, useState } from 'react'
import LucideIcon, { ICON_LIBRARY, isLucideIconName, parseLucideUrl } from '../../lib/lucide'

interface Props {
  value?: string | null
  onChange: (name: string | null) => void
  allowNone?: boolean
  autoFocus?: boolean
}

export default function IconPicker({ value, onChange, allowNone = true, autoFocus = true }: Props) {
  const [query, setQuery] = useState('')
  // Easter egg: paste a Lucide icon URL (e.g. https://lucide.dev/icons/anchor)
  // into the search box to add any icon from the full library, not just the
  // curated set below. `pasted` is the validated icon name once confirmed real.
  const [pasted, setPasted] = useState<string | null>(null)

  useEffect(() => {
    const name = parseLucideUrl(query)
    if (!name) { setPasted(null); return }
    let alive = true
    isLucideIconName(name).then(ok => { if (alive) setPasted(ok ? name : null) })
    return () => { alive = false }
  }, [query])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? ICON_LIBRARY.filter(d => d.name.includes(q) || d.label.toLowerCase().includes(q) || d.keywords.includes(q))
      : ICON_LIBRARY
    const map = new Map<string, typeof ICON_LIBRARY>()
    for (const d of list) {
      if (!map.has(d.group)) map.set(d.group, [])
      map.get(d.group)!.push(d)
    }
    return Array.from(map.entries())
  }, [query])

  return (
    <div className="icon-picker">
      <input
        className="form-input icon-picker-search"
        placeholder="Sök ikon…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus={autoFocus}
      />
      <div className="icon-picker-scroll">
        {allowNone && (
          <button
            type="button"
            className={`icon-picker-btn icon-picker-none${!value ? ' active' : ''}`}
            title="Ingen ikon"
            onClick={() => onChange(null)}
          >
            Ingen
          </button>
        )}
        {pasted && (
          <div className="icon-picker-group">
            <div className="icon-picker-group-title">Från Lucide ✨</div>
            <div className="icon-picker-grid">
              <button
                type="button"
                className={`icon-picker-btn${value === pasted ? ' active' : ''}`}
                title={pasted}
                aria-label={pasted}
                aria-pressed={value === pasted}
                onClick={() => onChange(pasted)}
              >
                <LucideIcon icon={pasted} size={20} />
              </button>
            </div>
          </div>
        )}
        {groups.map(([group, defs]) => (
          <div key={group} className="icon-picker-group">
            <div className="icon-picker-group-title">{group}</div>
            <div className="icon-picker-grid">
              {defs.map(d => (
                <button
                  key={d.name}
                  type="button"
                  className={`icon-picker-btn${value === d.name ? ' active' : ''}`}
                  title={d.label}
                  aria-label={d.label}
                  aria-pressed={value === d.name}
                  onClick={() => onChange(d.name)}
                >
                  <LucideIcon icon={d.name} size={20} />
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && !pasted && (
          <p className="icon-picker-empty">
            {parseLucideUrl(query)
              ? 'Ingen sådan Lucide-ikon hittades.'
              : `Inga ikoner matchar ”${query}”.`}
          </p>
        )}
      </div>
    </div>
  )
}
