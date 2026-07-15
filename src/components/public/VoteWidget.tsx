import type { SiteSettings } from '../../lib/types'
import CountUp from './CountUp'

// Floating call-to-action shown on the right on wide screens: the live
// signature count (animated) plus a prominent "sign" button. Follows the
// page as you scroll.
export default function VoteWidget({ settings, variant = 'floating' }: { settings: SiteSettings | null; variant?: 'floating' | 'inline' }) {
  const count = settings?.signature_count ?? 0
  const petition = settings?.petition_url ?? '#'

  return (
    <aside className={variant === 'inline' ? 'vote-widget vote-widget-inline' : 'vote-widget'} aria-label="Namninsamling">
      <span className="vote-widget-label">Underskrifter</span>
      <span className="vote-widget-count"><CountUp value={count} /></span>
      <p className="vote-widget-text">Var med och gör skillnad – skriv under du också.</p>
      <a href={petition} target="_blank" rel="noopener noreferrer" className="vote-widget-btn">Skriv under</a>
    </aside>
  )
}
