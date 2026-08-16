/**
 * A7 error state — the one that matters.
 *
 * The score is arithmetic over published data and never needed the model.
 * When plan generation fails, the honest response is to say exactly that and
 * keep the number on screen, not to throw the measurement away because the
 * writing step timed out.
 *
 * So this renders *beside* the report, never instead of it.
 */
export default function PlanFailure({ message, score, onRetry, onDismiss }) {
  return (
    <section className="state state--error" role="alert">
      <span className="mono-label state__label">Plan generation failed</span>
      <h3>Your score survived. The plan didn&apos;t.</h3>
      <p>
        The measurement is pure computation, so{' '}
        <strong>{score != null ? `${score} still stands` : 'your score still stands'}</strong>.
        Only the written plan needs the model{message ? `, and it ${failureTail(message)}` : ''}.
      </p>
      <div className="state__actions">
        <button type="button" className="btn-accent" onClick={onRetry}>Retry the plan</button>
        <button type="button" className="btn-quiet" onClick={onDismiss}>Keep the score</button>
      </div>
    </section>
  )
}

/** Turn a raw error into the tail of a sentence, without leaking a stack. */
function failureTail(message) {
  const m = String(message).toLowerCase()
  if (m.includes('timeout') || m.includes('timed out')) return 'timed out'
  if (m.includes('rate') || m.includes('429')) return 'is rate-limited right now'
  if (m.includes('key') || m.includes('auth') || m.includes('401')) return 'is not authenticated'
  if (m.includes('reach') || m.includes('network') || m.includes('fetch')) return 'could not be reached'
  return 'did not answer'
}
