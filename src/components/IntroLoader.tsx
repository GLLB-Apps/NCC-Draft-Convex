import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

// First-load / start-page intro: a white fullscreen while the logo draws + fills
// itself in the centre, then the finished mark flies to the header logo's
// position and the overlay fades to reveal the site. Plays on every full page
// load and every time you navigate to the start page. Skipped under
// prefers-reduced-motion.
const DRAW_MS = 3600 // let the logo draw + fill itself
const MORPH_MS = 850 // fly to the header logo position
const FADE_MS = 450 // fade the white overlay away

// One playthrough. Re-keyed to replay.
function IntroRun() {
  const [svg, setSvg] = useState('')
  const [morphing, setMorphing] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [done, setDone] = useState(false)
  const logoRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let cancelled = false
    const timers: number[] = []

    fetch('/loader/ncc_rs_logo_loader.svg')
      .then(r => r.text())
      .then(text => {
        if (cancelled) return
        setSvg(text)
        timers.push(window.setTimeout(() => {
          // Freeze the drawn logo (via the is-morphing class) and, on the next
          // frames, fly it onto the header logo image (FLIP).
          setMorphing(true)
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const el = logoRef.current
            const target = document.querySelector('.site-logo-badge .logo-img') as HTMLElement | null
            if (!cancelled && el && target) {
              const t = target.getBoundingClientRect()
              const l = el.getBoundingClientRect()
              if (t.height > 0 && l.height > 0) {
                const scale = t.height / l.height
                const dx = (t.left + t.width / 2) - (l.left + l.width / 2)
                const dy = (t.top + t.height / 2) - (l.top + l.height / 2)
                el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
              }
            }
          }))
          timers.push(window.setTimeout(() => {
            document.body.style.overflow = prevOverflow // let the revealed page scroll
            setHiding(true)
          }, MORPH_MS))
          timers.push(window.setTimeout(() => setDone(true), MORPH_MS + FADE_MS))
        }, DRAW_MS))
      })
      .catch(() => { if (!cancelled) { document.body.style.overflow = prevOverflow; setDone(true) } })

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  if (done) return null

  return (
    <div className={`intro-loader${hiding ? ' is-hiding' : ''}`} aria-hidden="true">
      <div
        ref={logoRef}
        className={`intro-loader-logo${morphing ? ' is-morphing' : ''}`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
}

export default function IntroLoader() {
  const location = useLocation()
  const reduce = useMemo(() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
  }, [])
  const [runId, setRunId] = useState(0)
  const prevPath = useRef(location.pathname)

  // Replay whenever we arrive at the start page.
  useEffect(() => {
    if (location.pathname === '/' && prevPath.current !== '/') setRunId(n => n + 1)
    prevPath.current = location.pathname
  }, [location.pathname])

  if (reduce) return null
  return <IntroRun key={runId} />
}
