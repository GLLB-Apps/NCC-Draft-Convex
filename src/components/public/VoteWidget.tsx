import { useState } from 'react'
import type { SiteSettings } from '../../lib/types'
import CountUp from './CountUp'

function Bullhorn() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11l13-5v12L3 13z" />
      <path d="M16 8.5a4 4 0 0 1 0 7" />
      <path d="M6 13.2V17a2 2 0 0 0 3.9.6" />
    </svg>
  )
}

// Floating call-to-action (desktop): live signature count + a "sign" button.
// Can be folded into a small bullhorn tab at the screen edge and slid back out.
export default function VoteWidget({ settings }: { settings: SiteSettings | null }) {
  // Start folded (just the bullhorn tab) on small screens so it doesn't cover content.
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  )
  const count = settings?.signature_count ?? 0
  const petition = settings?.petition_url ?? '#'

  return (
    <>
      <aside className={collapsed ? 'vote-widget is-collapsed' : 'vote-widget'} aria-label="Namninsamling" aria-hidden={collapsed}>
        <button className="vote-widget-fold" onClick={() => setCollapsed(true)} aria-label="Fäll ihop" title="Fäll ihop">›</button>
        <span className="vote-widget-label">Underskrifter</span>
        <span className="vote-widget-count"><CountUp value={count} /></span>
        <p className="vote-widget-text">Var med och gör skillnad – skriv under du också.</p>
        <a href={petition} target="_blank" rel="noopener noreferrer" className="vote-widget-btn">Skriv under</a>
      </aside>

      <button
        className={collapsed ? 'vote-widget-tab is-visible' : 'vote-widget-tab'}
        onClick={() => setCollapsed(false)}
        aria-label="Visa namninsamling"
        title="Namninsamling"
      >
        <Bullhorn />
      </button>
    </>
  )
}
