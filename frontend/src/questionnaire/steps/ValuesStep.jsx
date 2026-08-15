import { WORK_VALUES, MAX_VALUES } from '../schema'

/**
 * The six work values O*NET's Work Importance Locator scores. Same source as
 * the task data, so this question is citable rather than invented.
 */
export default function ValuesStep({ answers, update }) {
  const chosen = answers.workValues

  function toggle(value) {
    if (chosen.includes(value)) {
      update({ workValues: chosen.filter((v) => v !== value) })
    } else if (chosen.length < MAX_VALUES) {
      update({ workValues: [...chosen, value] })
    }
  }

  return (
    <div className="qn__step">
      <p className="qn__hint">
        Pick up to {MAX_VALUES}. These are the work values used by O*NET's
        Work Importance Locator — the same source as the task data behind
        your score.
      </p>

      <ul className="qn__choices qn__choices--grid">
        {WORK_VALUES.map((v) => {
          const on = chosen.includes(v.value)
          const full = !on && chosen.length >= MAX_VALUES
          return (
            <li key={v.value}>
              <button
                type="button"
                className={'qn__choice qn__choice--stack' + (on ? ' qn__choice--on' : '')}
                aria-pressed={on}
                disabled={full}
                onClick={() => toggle(v.value)}
              >
                <span>{v.label}</span>
                <span className="qn__meta">{v.hint}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
