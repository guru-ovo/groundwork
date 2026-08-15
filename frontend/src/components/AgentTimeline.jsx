/**
 * The agent's steps as they arrive.
 *
 * This is not a loading state dressed up. Each row is a real query against
 * the grounded dataset, and showing them is the only honest way to
 * demonstrate that the plan came from the data rather than the model.
 */
export default function AgentTimeline({ steps, phase, reading, running }) {
  if (steps.length === 0 && !running && !reading) return null

  return (
    <section className="timeline" aria-live="polite">
      <h3 className="timeline__heading">Working through the data</h3>

      {reading && (
        <div className="reading">
          <p className="reading__text">{reading.reading}</p>
          {reading.hard_constraints?.length > 0 && (
            <ul className="reading__list">
              {reading.hard_constraints.map((c) => (
                <li key={c}><span className="reading__tag">must respect</span>{c}</li>
              ))}
            </ul>
          )}
          {reading.implied_strengths?.length > 0 && (
            <ul className="reading__list">
              {reading.implied_strengths.map((s) => (
                <li key={s}><span className="reading__tag">you already</span>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ol className="timeline__list">
        {steps.map((step) => (
          <li key={step.n} className="timeline__item">
            <p className="timeline__thought">{step.thought}</p>
            <p className="timeline__obs">
              <span className="timeline__tool">{step.tool}</span>
              {step.observation}
            </p>
          </li>
        ))}
        {running && (
          <li className="timeline__item timeline__item--pending">
            <p className="timeline__thought">{phase || 'Thinking'}<span className="timeline__dots" /></p>
          </li>
        )}
      </ol>
    </section>
  )
}
