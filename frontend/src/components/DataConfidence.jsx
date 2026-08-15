/**
 * What the score is built on, stated plainly.
 *
 * Groundwork's claim is that its numbers come from published data rather
 * than a model's opinion. That claim is only worth making if it also says
 * when the data is thin — an occupation with 4% observed-usage coverage and
 * one with 80% both render as a two-digit number otherwise, and the reader
 * has no way to tell them apart.
 *
 * Shown as fact, not warning. The point is calibration, not alarm.
 */
export default function DataConfidence({ coverage, ratingsEstimated, taskCount }) {
  if (coverage == null && !ratingsEstimated) return null

  const pct = coverage == null ? null : Math.round(coverage * 100)

  return (
    <section className="confidence">
      <h4 className="confidence__heading">What this score is built on</h4>
      <ul className="confidence__list">
        <li>
          <span className="confidence__value">{taskCount}</span> O*NET task
          statements, each carrying an Eloundou et al. exposure measure.
        </li>
        {pct != null && (
          <li>
            <span className="confidence__value">{pct}%</span> of them also have
            observed-usage data from the Anthropic Economic Index.
            {pct === 0 && ' The rest is scored on the exposure measure alone.'}
          </li>
        )}
        {ratingsEstimated && (
          <li>
            O*NET has not surveyed this occupation yet, so its tasks are
            weighted equally rather than by measured importance and frequency.
            The exposure data is unaffected.
          </li>
        )}
      </ul>
    </section>
  )
}
