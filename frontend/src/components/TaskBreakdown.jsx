import { useMemo, useState } from 'react'

const SORTS = {
  exposure: { label: 'Exposure', get: (t) => t.composite_exposure },
  importance: { label: 'Importance', get: (t) => t.onet_importance },
  coverage: { label: 'Coverage', get: (t) => (t.has_economic_index ? 1 : 0) },
}

/**
 * Every task, and the arithmetic behind it.
 *
 * A real <table>: this is tabular data, and the semantics buy column
 * association, screen-reader navigation and sortable headers for free.
 * Numerics are tabular-figure and right-aligned so columns of figures can be
 * read down as well as across.
 */
export default function TaskBreakdown({ resilience }) {
  const [sort, setSort] = useState('exposure')

  const tasks = useMemo(() => {
    const all = [
      ...(resilience?.at_risk_tasks || []),
      ...(resilience?.resilient_tasks || []),
    ]
    const get = SORTS[sort].get
    return [...all].sort((a, b) => get(b) - get(a) || b.composite_exposure - a.composite_exposure)
  }, [resilience, sort])

  if (!resilience || tasks.length === 0) return null

  return (
    <section className="breakdown">
      <header className="breakdown__head">
        <div className="breakdown__headings">
          <span className="mono-label breakdown__kicker">All {tasks.length} tasks</span>
          <h3>Every task, and the arithmetic behind it</h3>
        </div>
        <div className="breakdown__sorts" role="group" aria-label="Sort tasks by">
          {Object.entries(SORTS).map(([key, s]) => (
            <button
              key={key}
              type="button"
              className={'sort' + (sort === key ? ' sort--on' : '')}
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
            >
              {s.label}{sort === key ? ' ↓' : ''}
            </button>
          ))}
        </div>
      </header>

      <div className="breakdown__scroll">
        <table className="tbl">
          <caption className="sr-only">
            Every task in this occupation with its exposure, O*NET importance and
            frequency ratings, Eloundou beta and Economic Index label. Sorted by{' '}
            {SORTS[sort].label.toLowerCase()}, highest first.
          </caption>
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col" aria-sort={sort === 'exposure' ? 'descending' : 'none'}>Exposure</th>
              <th scope="col" className="num" aria-sort={sort === 'importance' ? 'descending' : 'none'}>Imp.</th>
              <th scope="col" className="num">Freq.</th>
              <th scope="col" className="num">β</th>
              <th scope="col" className="num">Economic Index</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => (
              <tr key={t.task_id}>
                <th scope="row" className="tbl__task">{t.task_description}</th>
                <td className="tbl__exposure">
                  <span className="tbl__track">
                    <span
                      className={'tbl__fill' + (t.composite_exposure >= 0.5 ? ' is-high' : '')}
                      style={{ width: `${Math.round(t.composite_exposure * 100)}%`, '--i': i }}
                    />
                  </span>
                  <span className={'tbl__pct' + (t.composite_exposure >= 0.5 ? ' is-high' : '')}>
                    {t.composite_exposure.toFixed(2)}
                  </span>
                </td>
                <td className="num">{t.onet_importance.toFixed(1)}</td>
                <td className="num">{t.onet_frequency.toFixed(1)}</td>
                <td className="num">{t.eloundou_beta.toFixed(2)}</td>
                <td className={'num tbl__ei' + (t.has_economic_index ? '' : ' is-absent')}>
                  {t.has_economic_index ? t.economic_index_label : 'not observed'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="breakdown__note">
        Exposure = Economic Index usage label blended with the Eloundou β, then
        weighted by O*NET importance × frequency. Where no usage was observed,
        the β carries the task alone rather than being averaged against a zero
        we cannot justify.
      </p>
    </section>
  )
}
