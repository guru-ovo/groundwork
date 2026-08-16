import { MAX_VALUES, WORK_VALUES } from '../schema'

/**
 * Step 3 — O*NET's six work values, pick at most two.
 *
 * The count is stated in words that change as you choose, rather than a
 * silent cap that only announces itself by refusing a click. Options past the
 * limit are disabled rather than hidden, so the constraint is visible and the
 * remaining choices stay readable.
 */
export default function ValuesStep({ answers, update }) {
  const chosen = answers.workValues
  const full = chosen.length >= MAX_VALUES

  function toggle(value) {
    const next = chosen.includes(value)
      ? chosen.filter((v) => v !== value)
      : chosen.length < MAX_VALUES
        ? [...chosen, value]
        : chosen
    update({ workValues: next })
  }

  const countLabel =
    chosen.length === 0 ? 'Choose two'
      : chosen.length === 1 ? 'One more'
        : 'Two chosen — that is the limit'

  return (
    <div className="qn__step">
      <p className={'qn__count' + (full ? ' qn__count--full' : '')} role="status">
        {countLabel}
      </p>

      <ul className="qn__choices qn__choices--grid">
        {WORK_VALUES.map((v) => {
          const on = chosen.includes(v.value)
          return (
            <li key={v.value}>
              <button
                type="button"
                className={'qn__value' + (on ? ' qn__value--on' : '')}
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(v.value)}
              >
                <span className="qn__value-title">
                  <span className="qn__value-dot" aria-hidden="true" />
                  {v.label}
                </span>
                <span className="qn__value-hint">{v.hint}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
