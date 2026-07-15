// Animated line-art icons for the topic areas, keyed by topic slug.
// Idle animations are subtle and disabled under prefers-reduced-motion (see public.css).
import type { JSX } from 'react'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const icons: Record<string, JSX.Element> = {
  // Buller och vibrationer — speaker + pulsing sound waves
  'buller-och-vibrationer': (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path className="tw-wave tw-wave-1" d="M16 8.8a4.5 4.5 0 0 1 0 6.4" />
      <path className="tw-wave tw-wave-2" d="M18.7 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  ),
  // Grundvatten och dricksvatten — bobbing water drop
  'grundvatten-och-dricksvatten': (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-drop" d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" />
      <path d="M9.6 13.4a2.5 2.5 0 0 0 2.4 2.6" />
    </svg>
  ),
  // Naturvärden — swaying leaf
  'naturvarden-och-biologisk-mangfald': (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-leaf" d="M5 19c0-8 5-13 14-13 0 9-5 14-14 13z" />
      <path className="tw-leaf" d="M5.5 18.5c3-4 6-6.5 9.5-7.5" />
    </svg>
  ),
  // Trafik och transporter — truck with pulsing wheels
  'trafik-och-transporter': (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M2.5 6.5h11v8.5h-11z" />
      <path d="M13.5 9.5H17l3.5 3.5v2H13.5z" />
      <circle className="tw-wheel" cx="7" cy="17.3" r="1.7" />
      <circle className="tw-wheel tw-wheel-2" cx="17" cy="17.3" r="1.7" />
    </svg>
  ),
  // Damm och luftkvalitet — drifting wind lines
  'damm-och-luftkvalitet': (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-wind tw-wind-1" d="M3 8h9a2.4 2.4 0 1 0-2.4-2.4" />
      <path className="tw-wind tw-wind-2" d="M3 12h13a2.4 2.4 0 1 1-2.4 2.4" />
      <path className="tw-wind tw-wind-3" d="M3 16h7" />
    </svg>
  ),
  // Friluftsliv och rekreation — mountains with a pulsing sun
  'friluftsliv-och-rekreation': (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <circle className="tw-sun" cx="17" cy="7" r="2.2" />
      <path d="M2.5 19l5.5-8.5 4 5 3-4L21.5 19z" />
    </svg>
  ),
}

const fallback = (
  <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
    <path className="tw-sun" d="M12 3l9 9-9 9-9-9z" />
  </svg>
)

export default function TopicIcon({ slug }: { slug: string }) {
  return icons[slug] ?? fallback
}
