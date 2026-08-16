/**
 * The agent's steps, as they stream.
 *
 * This is not a loading state dressed up. Each row is a real query against the
 * task data with the observation it returned, which is the only honest way to
 * show that the plan came from the data rather than from the model's
 * imagination.
 *
 * Rows enter staggered, but the stagger is a delay on an entrance that ends
 * visible — a row that never animates is still a readable row.
 */
export default function AgentTimeline({ steps, phase, reading, running, startedAt }) {
  const hasContent = steps.length > 0 || reading || running

  if (!hasContent) return null

  return (
    <section className="timeline" aria-live="polite">
      <div className="timeline__bar">
        <h3 className="timeline__heading">Working</h3>
        <span className="timeline__counter">
          {steps.length > 0
            ? `${steps.length} step${steps.length === 1 ? '' : 's'}`
            : phase || 'starting'}
        </span>
      </div>

      {reading && (
        <div className="reading">
          <p className="reading__text">{reading.reading}</p>
          {reading.hard_constraints?.length > 0 && (
            <ul className="reading__list">
              {reading.hard_constraints.map((c) => (
                <li key={c}><span className="reading__tag">constraint</span>{c}</li>
              ))}
            </ul>
          )}
          {reading.implied_strengths?.length > 0 && (
            <ul className="reading__list">
              {reading.implied_strengths.map((s) => (
                <li key={s}><span className="reading__tag">strength</span>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ol className="timeline__list">
        {steps.map((step, i) => (
          <li key={`${step.n}-${step.tool}`} className="timeline__item" style={{ '--i': i }}>
            <div className="timeline__spine" aria-hidden="true">
              <span className="timeline__dot" />
              <span className="timeline__line" />
            </div>
            <div className="timeline__body">
              <div className="timeline__meta">
                <span className="timeline__tool">{step.tool}</span>
                {step.ms != null && <span className="timeline__ms">{step.ms}</span>}
              </div>
              <p className="timeline__thought">{step.thought}</p>
              {step.observation && <p className="timeline__obs">{step.observation}</p>}
            </div>
          </li>
        ))}

        {running && (
          <li className="timeline__item timeline__item--pending">
            <div className="timeline__spine" aria-hidden="true">
              <span className="timeline__dot timeline__dot--pending" />
            </div>
            <p className="timeline__pending">
              {phase || 'Querying the task data'}
              <span className="timeline__dots" aria-hidden="true" />
            </p>
          </li>
        )}
      </ol>
    </section>
  )
}
