import { useEffect, useRef } from 'react'

// 1.01^365 and 0.99^365. Both are just arithmetic, and both are exactly true.
const UP = Math.pow(1.01, 365)     // 37.78
const DOWN = Math.pow(0.99, 365)   // 0.0255
const WEEKS_IN_PLAN = 78           // the plan's own horizon: 18 months

/**
 * The long game.
 *
 * Everything else on this page is a measurement. This is not, and it says so
 * — because the product's whole claim is that its figures are computed rather
 * than written, and smuggling a motivational number in beside them would cost
 * more credibility than the encouragement is worth.
 *
 * What keeps it from being a poster slogan is the second half: it multiplies
 * the person's own stated hours out over the plan's own horizon. That total is
 * real, it is theirs, and it is usually larger than they expect.
 */
export default function Compounding({ weeklyHours }) {
  const upRef = useRef(null)

  useEffect(() => {
    const el = upRef.current
    if (!el) return

    // The finished value first: if no frame ever runs, the true figure stands.
    el.textContent = UP.toFixed(1)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let start = 0
    const DURATION = 1800
    const ease = (t) => 1 - Math.pow(1 - t, 3)

    const tick = (now) => {
      if (!start) {
        start = now
        el.textContent = '1.0'
        raf = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(1, (now - start) / DURATION)
      el.textContent = (1 + (UP - 1) * ease(t)).toFixed(1)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      el.textContent = UP.toFixed(1)
    }
  }, [])

  const totalHours = weeklyHours ? Math.round(weeklyHours * WEEKS_IN_PLAN) : null

  return (
    <section className="compound">
      <div className="compound__head">
        <span className="mono-label compound__kicker">The long game</span>
        <span className="compound__aside">illustration, not a measurement</span>
      </div>

      <div className="compound__body">
        <div className="compound__figures">
          <div className="compound__fig">
            <span className="compound__expr">1.01<sup>365</sup></span>
            <span className="compound__eq" aria-hidden="true">=</span>
            <span className="compound__val compound__val--up" ref={upRef}>
              {UP.toFixed(1)}
            </span>
          </div>
          <div className="compound__fig compound__fig--down">
            <span className="compound__expr">0.99<sup>365</sup></span>
            <span className="compound__eq" aria-hidden="true">=</span>
            <span className="compound__val compound__val--down">{DOWN.toFixed(2)}</span>
          </div>
        </div>

        <div className="compound__copy">
          <p className="compound__lede">
            One percent better every day for a year multiplies you by{' '}
            <strong>thirty-eight</strong>. One percent worse divides you to
            almost nothing. The two habits look identical on any given Tuesday.
          </p>

          {totalHours != null && (
            <p className="compound__own">
              You told us <strong>{formatHours(weeklyHours)} a week</strong>. Across
              the eighteen months this plan covers, that is{' '}
              <strong>{totalHours.toLocaleString()} hours</strong> — more than
              enough to become the person who reviews the model rather than the
              one it replaces. The number that matters is not the score at the
              top of this page. It is whether you are still doing this in March.
            </p>
          )}

          <p className="compound__honest">
            This section is arithmetic about consistency, not a finding about
            you. Nothing in it came from your task data, and no part of your
            score depends on it.
          </p>
        </div>
      </div>
    </section>
  )
}

function formatHours(h) {
  const n = Number(h)
  if (!Number.isFinite(n)) return `${h} hours`
  const rounded = Number.isInteger(n) ? n : n.toFixed(1)
  return `${rounded} hour${n === 1 ? '' : 's'}`
}
