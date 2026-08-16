import { useEffect, useRef } from 'react'

const R = 48
const CIRCUMFERENCE = 2 * Math.PI * R // 301.59

/**
 * The score, as a ring.
 *
 * Two deliberate choices from the handoff:
 *
 * 1. The count-up is written straight to the DOM. Driving ~60 setState calls
 *    a second would re-render the whole results tree for a number that only
 *    one text node cares about, and on a slow device the render cost is what
 *    makes the count stutter. A ref and one `textContent` write per frame
 *    keeps it smooth and costs React nothing.
 *
 * 2. It renders its finished value first and only then animates. If the
 *    animation never runs — reduced motion, a print, a hidden tab — the
 *    correct number is already on screen. Nothing here can strand the score
 *    at zero.
 */
export default function ResilienceGauge({
  score,
  occupationTitle,
  socCode,
  note = 'Computed from published data · no model involved',
}) {
  const numberRef = useRef(null)
  const arcRef = useRef(null)

  useEffect(() => {
    const el = numberRef.current
    const arc = arcRef.current
    if (!el || !arc) return

    const target = Math.max(0, Math.min(100, Number(score) || 0))
    const offset = CIRCUMFERENCE * (1 - target / 100)

    // The resting state, applied synchronously: correct with or without motion.
    el.textContent = String(target)
    arc.style.strokeDashoffset = String(offset)

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let start = 0
    const DURATION = 2200
    // The same curve as every other entrance, sampled rather than declared.
    const ease = (t) => 1 - Math.pow(1 - t, 3)

    const tick = (now) => {
      if (!start) {
        // Rewind to zero only here, inside a frame that has demonstrably run.
        // Doing it before requesting the frame is the bug this avoids: in a
        // background tab, a print, or any context where rAF never fires, the
        // score would sit at 0 forever — a wrong number, not a missing one.
        start = now
        el.textContent = '0'
        arc.style.strokeDashoffset = String(CIRCUMFERENCE)
        raf = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(1, (now - start) / DURATION)
      const eased = ease(t)
      el.textContent = String(Math.round(target * eased))
      arc.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - (target / 100) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      // If we are torn down mid-count, leave the true value behind.
      el.textContent = String(target)
      arc.style.strokeDashoffset = String(offset)
    }
  }, [score])

  return (
    <div className="gauge">
      <div className="gauge__ring">
        <div className="gauge__halo" aria-hidden="true" />
        <svg width="112" height="112" viewBox="0 0 112 112" className="gauge__svg">
          <circle cx="56" cy="56" r={R} className="gauge__track" fill="none" strokeWidth="7" />
          <circle
            ref={arcRef}
            cx="56" cy="56" r={R}
            className="gauge__arc"
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
        {/* The live region is the number itself; the ring is decoration. */}
        <span className="gauge__score" ref={numberRef} aria-hidden="true">
          {score}
        </span>
      </div>

      <div className="gauge__label">
        <span className="gauge__eyebrow">Resilience</span>
        <h2>{occupationTitle}</h2>
        <span className="gauge__note">{note}</span>
        <p className="sr-only">
          {occupationTitle}
          {socCode ? ` (${socCode})` : ''} scores {score} out of 100 for task
          resilience.
        </p>
      </div>
    </div>
  )
}
