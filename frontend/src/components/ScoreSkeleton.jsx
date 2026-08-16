/**
 * A7 loading state — skeleton rows matching the eventual layout, never a
 * spinner, and carrying real progress rather than a vague reassurance.
 *
 * The stage text is truthful about what the server is doing: the score is a
 * join across two datasets, and saying so is more useful than "Loading…".
 */
export default function ScoreSkeleton({ stage = 'Joining datasets' }) {
  return (
    <section className="state state--loading" aria-live="polite" aria-busy="true">
      <span className="mono-label state__label state__label--live">{stage}</span>
      <h3>Reading your tasks against two sources</h3>

      <div className="state__skeleton" aria-hidden="true">
        {['72%', '54%', '83%', '46%'].map((w, i) => (
          <span
            key={w}
            className="skeleton-bar"
            style={{ width: w, animationDelay: `${i * 140}ms` }}
          />
        ))}
      </div>

      <p className="state__progress">Pulling O*NET tasks, then joining exposure data</p>
    </section>
  )
}
