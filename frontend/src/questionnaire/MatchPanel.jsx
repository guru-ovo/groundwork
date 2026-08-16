import { useEffect, useState } from 'react'
import { getAdjacent, getResilience } from '../api'

/**
 * "What we already know about this match" — the right half of the split shell.
 *
 * Everything shown here is pure computation on the server, so it lands in
 * milliseconds. Filling it in the moment an occupation is picked is the
 * point: it makes the match consequential while the user can still change it,
 * rather than revealing what they committed to seven steps later.
 *
 * It never blocks the form. If either request fails the panel simply says
 * less; the questionnaire is unaffected.
 */
export default function MatchPanel({ socCode, occupationTitle }) {
  const [data, setData] = useState(null)
  const [neighbours, setNeighbours] = useState([])
  const [state, setState] = useState('idle')

  useEffect(() => {
    if (!socCode) {
      setData(null)
      setNeighbours([])
      setState('idle')
      return
    }

    let live = true
    setState('loading')

    Promise.all([
      getResilience(socCode),
      getAdjacent(socCode, 3).catch(() => ({ neighbours: [] })),
    ])
      .then(([resilience, adj]) => {
        if (!live) return
        setData(resilience)
        setNeighbours(adj.neighbours || [])
        setState('ready')
      })
      .catch(() => live && setState('failed'))

    return () => { live = false }
  }, [socCode])

  return (
    <aside className="mp" aria-live="polite">
      <div className="mp__grain" aria-hidden="true" />

      <header className="mp__head">
        <span className="mono-label">What we already know about this match</span>
      </header>

      <div className="mp__body">
        {state === 'idle' && (
          <p className="mp__idle">
            Pick an occupation and its measured task data appears here — before
            you answer anything else.
          </p>
        )}

        {state === 'loading' && <Skeleton />}

        {state === 'failed' && (
          <p className="mp__idle">
            The task data could not be loaded just now. It does not affect your
            answers — carry on, and the report will fetch it again.
          </p>
        )}

        {state === 'ready' && data && (
          <>
            <dl className="mp__rows">
              <Row label="Occupation" value={occupationTitle || data.occupation_title} />
              <Row label="O*NET code" value={data.soc_code} mono />
              <Row label="Tasks on file" value={taskCount(data)} mono />
              <Row
                label="Observed-usage coverage"
                value={`${Math.round((data.economic_index_coverage ?? 0) * 100)}%`}
                mono
              />
              <Row
                label="Median task exposure"
                value={median(data).toFixed(2)}
                mono
              />
              <Row
                label="Task ratings"
                value={data.ratings_estimated ? 'Estimated' : 'O*NET incumbent'}
              />
              {neighbours.length > 0 && (
                <Row
                  label="Nearest occupations"
                  value={neighbours.map((n) => n.title).join(' · ')}
                />
              )}
            </dl>

            {/* Stated here, on the way in — not buried in the report. */}
            <div className="mp__limit">
              <span className="mono-label mp__limit-label">Honest limitation</span>
              <p>
                The Economic Index measures AI use that has already been
                observed. It is not a forecast of job loss, and we won&apos;t
                dress it up as one.
              </p>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}

function Row({ label, value, mono }) {
  return (
    <div className="mp__row">
      <dt>{label}</dt>
      <dd className={mono ? 'mp__val mp__val--mono' : 'mp__val'}>{value}</dd>
    </div>
  )
}

/** Skeleton rows matching the eventual layout — never a spinner. */
function Skeleton() {
  return (
    <div className="mp__skeleton" aria-hidden="true">
      {['72%', '54%', '81%', '46%', '63%'].map((w, i) => (
        <span key={w} className="skeleton-bar" style={{ width: w, animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  )
}

function taskCount(d) {
  return String((d.at_risk_tasks?.length || 0) + (d.resilient_tasks?.length || 0))
}

function median(d) {
  const all = [...(d.at_risk_tasks || []), ...(d.resilient_tasks || [])]
    .map((t) => t.composite_exposure)
    .sort((a, b) => a - b)
  if (!all.length) return 0
  const mid = Math.floor(all.length / 2)
  return all.length % 2 ? all[mid] : (all[mid - 1] + all[mid]) / 2
}
