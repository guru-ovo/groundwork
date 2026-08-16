/**
 * What the score is built on, stated plainly.
 *
 * Groundwork's claim is that its numbers come from published data rather than
 * a model's opinion. That claim is only worth making if it also says when the
 * data is thin — an occupation with 4% observed-usage coverage and one with
 * 80% both render as a two-digit number otherwise, and the reader has no way
 * to tell them apart.
 *
 * Shown as fact, not warning. The point is calibration, not alarm.
 */
export default function DataConfidence({ coverage, ratingsEstimated, taskCount }) {
  if (coverage == null && !ratingsEstimated) return null

  const pct = coverage == null ? null : Math.round(coverage * 100)

  return (
    <section className="confidence">
      <dl className="confidence__rows">
        <Row label="Tasks measured" value={taskCount} />
        {pct != null && <Row label="Observed-usage coverage" value={`${pct}%`} />}
        <Row label="Task weighting" value={ratingsEstimated ? 'Estimated' : 'O*NET incumbent'} />
      </dl>

      <p className="confidence__note">
        {pct === 0
          ? 'No observed-usage data covers this occupation yet, so the score rests on the published exposure measure alone.'
          : 'Where observed usage is missing, the published exposure measure carries the task on its own.'}
        {ratingsEstimated &&
          ' O*NET has not surveyed this occupation, so tasks are weighted equally rather than by measured importance and frequency. The exposure data is unaffected.'}
      </p>
    </section>
  )
}

function Row({ label, value }) {
  return (
    <div className="confidence__row">
      <dt>{label}</dt>
      <dd className="confidence__value">{value}</dd>
    </div>
  )
}
