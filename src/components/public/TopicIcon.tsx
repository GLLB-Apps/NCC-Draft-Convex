// Animated line-art icons for topic areas, chosen per topic (stored in
// topics.icon). Idle animations are subtle and disabled under
// prefers-reduced-motion (see public.css `tw-*` keyframes).
import type { JSX } from 'react'

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const icons: Record<string, JSX.Element> = {
  sound: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path className="tw-wave tw-wave-1" d="M16 8.8a4.5 4.5 0 0 1 0 6.4" />
      <path className="tw-wave tw-wave-2" d="M18.7 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  ),
  water: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-drop" d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3z" />
      <path d="M9.6 13.4a2.5 2.5 0 0 0 2.4 2.6" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-leaf" d="M5 19c0-8 5-13 14-13 0 9-5 14-14 13z" />
      <path className="tw-leaf" d="M5.5 18.5c3-4 6-6.5 9.5-7.5" />
    </svg>
  ),
  tree: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <polygon className="tw-leaf" points="12,3 7.5,10.5 16.5,10.5" />
      <polygon className="tw-leaf" points="12,8 6,17 18,17" />
      <path d="M12 17v4" />
    </svg>
  ),
  wind: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-wind tw-wind-1" d="M3 8h9a2.4 2.4 0 1 0-2.4-2.4" />
      <path className="tw-wind tw-wind-2" d="M3 12h13a2.4 2.4 0 1 1-2.4 2.4" />
      <path className="tw-wind tw-wind-3" d="M3 16h7" />
    </svg>
  ),
  mountain: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <circle className="tw-sun" cx="17" cy="7" r="2.2" />
      <path d="M2.5 19l5.5-8.5 4 5 3-4L21.5 19z" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M2.5 6.5h11v8.5h-11z" />
      <path d="M13.5 9.5H17l3.5 3.5v2H13.5z" />
      <circle className="tw-wheel" cx="7" cy="17.3" r="1.7" />
      <circle className="tw-wheel tw-wheel-2" cx="17" cy="17.3" r="1.7" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M4 11l8-6 8 6" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-5h4v5" />
    </svg>
  ),
  health: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path className="tw-sun" d="M12 20s-7-4.6-7-9.6A3.4 3.4 0 0 1 12 7a3.4 3.4 0 0 1 7 3.4c0 5-7 9.6-7 9.6z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
      <path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  ),
}

// Ordered list for the admin icon picker (key + human label).
export const TOPIC_ICONS: { key: string; label: string }[] = [
  { key: 'sound', label: 'Ljud' },
  { key: 'water', label: 'Vatten' },
  { key: 'leaf', label: 'Löv' },
  { key: 'tree', label: 'Skog' },
  { key: 'wind', label: 'Luft' },
  { key: 'mountain', label: 'Landskap' },
  { key: 'truck', label: 'Trafik' },
  { key: 'home', label: 'Bostad' },
  { key: 'health', label: 'Hälsa' },
  { key: 'shield', label: 'Skydd' },
  { key: 'clock', label: 'Tid' },
  { key: 'map', label: 'Plats' },
]

const fallback = (
  <svg viewBox="0 0 24 24" className="topic-icon-svg" {...S}>
    <path className="tw-sun" d="M12 3l9 9-9 9-9-9z" />
  </svg>
)

export default function TopicIcon({ icon }: { icon?: string | null }) {
  return (icon && icons[icon]) || fallback
}
