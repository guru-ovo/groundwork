import { downloadPlanAsPdf } from '../lib/printPlan'
import Compounding from './Compounding'

const SOURCES =
  'O*NET task ratings · Anthropic Economic Index · Eloundou, Manning, Mishkin & Rock (2023)'

/**
 * The results, as a report rather than a dashboard.
 *
 * Structure carries the argument: what is under pressure and what is holding,
 * side by side; where the role could go; then the plan, each milestone naming
 * the figure that justifies it; then the sources.
 *
 * The score half renders from `resilience` alone. `plan` is the only
 * LLM-dependent input and every part of it is guarded, so a failed or missing
 * plan costs the reader the written sections and nothing else.
 */
export default function ResultsReport({ resilience, plan, weeklyHours, onStartOver }) {
  if (!resilience) return null

  const atRisk = resilience.at_risk_tasks || []
  const holding = resilience.resilient_tasks || []
  const title = resilience.occupation_title

  const current = plan?.path?.find((n) => n.is_current)
  const destination = plan?.path?.find((n) => !n.is_current)

  return (
    <section className="report">
      {/* Print-only masthead. On screen the header below already says all of
          this; on paper the document has to introduce itself, because it
          travels away from the app. */}
      <header className="report__masthead" aria-hidden="true">
        <p className="report__masthead-brand">Groundwork</p>
        <h1 className="report__masthead-title">{title}</h1>
        <p className="report__masthead-sub">
          Task-level AI exposure and a plan built from it. Generated{' '}
          {new Date().toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
          })}.
        </p>
      </header>

      <header className="report__head">
        <div className="report__headings">
          <span className="mono-label report__kicker">
            Report · {resilience.soc_code} · generated {new Date().toLocaleDateString(undefined, {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
          <h2 className="report__title">{title}</h2>
          <p className="report__lede">{lede(resilience, atRisk, holding)}</p>
        </div>
        <div className="report__actions">
          <button type="button" className="btn-quiet" onClick={onStartOver}>Start over</button>
          <button type="button" className="btn-accent" onClick={() => downloadPlanAsPdf(title)}>
            Save as PDF
          </button>
        </div>
      </header>

      <div className="report__columns">
        <TaskColumn
          tone="risk"
          label="Under pressure"
          tasks={atRisk}
          empty="No task in this occupation scores at or above 0.5 exposure."
        />
        <TaskColumn
          tone="hold"
          label="Holding"
          tasks={holding}
          empty="Every task here scores at or above 0.5 exposure — nothing sits in the holding column."
        />
      </div>

      {destination && (
        <section className="report__path">
          <span className="mono-label">Where this could go</span>
          <div className="path">
            <div className="path__node">
              <span className="path__score path__score--from">{current?.resilience_score}</span>
              <span className="path__title">{current?.title || title}</span>
              <span className="path__cap">where you are</span>
            </div>
            <div className="path__link">
              <span className="path__rule" aria-hidden="true" />
              <span className="path__meta">
                {[
                  destination.overlap_pct != null && `${destination.overlap_pct}% task overlap`,
                  destination.interest_fit != null && `${destination.interest_fit}% interest fit`,
                ].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="path__node path__node--end">
              <span
                className={
                  'path__score path__score--' +
                  (destination.resilience_score > (current?.resilience_score ?? 0) ? 'to' : 'flat')
                }
              >
                {destination.resilience_score}
              </span>
              <span className="path__title">{destination.title}</span>
              {/* Only call it higher ground when it measurably is. Labelling a
                  lower-scoring role as an improvement is the one thing this
                  page cannot do and keep its claim. */}
              <span className="path__cap">
                {destination.resilience_score > (current?.resilience_score ?? 0)
                  ? 'nearest higher ground'
                  : 'closest by task overlap'}
              </span>
            </div>
          </div>
          {destination.rationale && <p className="report__rationale">{destination.rationale}</p>}
        </section>
      )}

      {plan?.summary && <p className="report__summary">{plan.summary}</p>}

      {plan?.phases?.length > 0 && (
        <div className="report__phases">
          {plan.phases.map((phase) => (
            <article key={phase.window} className="phase">
              <div className="phase__head">
                <span className="mono-label phase__window">{phase.window}</span>
                {phase.load && <span className="phase__load">{phase.load}</span>}
              </div>
              <ul className="phase__milestones">
                {phase.milestones?.map((m) => (
                  <li key={m.action}>
                    <span className="phase__action">{m.action}</span>
                    {/* The check that makes the milestone a milestone rather
                        than an intention. Guarded: older plans lack it. */}
                    {m.done_when && (
                      <span className="phase__done">
                        <span className="phase__done-label">Done when</span>
                        {m.done_when}
                      </span>
                    )}
                    {m.reason && <span className="phase__reason">{m.reason}</span>}
                    <span className="phase__foot">
                      {m.data_source && <span className="phase__source">{m.data_source}</span>}
                      {m.effort && <span className="phase__effort">{m.effort}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}

      {/* After the plan, before the sources: the last thing read should be
          what makes the plan work, and the sources still get the final word. */}
      <Compounding weeklyHours={weeklyHours} />

      <footer className="report__colophon">
        <p>
          {SOURCES}. Every score, overlap and fit figure on this page was
          computed. The language model wrote the sentences, not the numbers.
          {plan?.generated_by === 'computation' &&
            ' This plan was written without one at all.'}
        </p>
      </footer>
    </section>
  )
}

function TaskColumn({ tone, label, tasks, empty }) {
  return (
    <section className={'tasks tasks--' + tone}>
      <div className="tasks__head">
        <span className="tasks__marker" aria-hidden="true" />
        <span className="mono-label">{label}</span>
        <span className="tasks__count">{tasks.length}</span>
      </div>

      {tasks.length === 0 ? (
        <p className="tasks__empty">{empty}</p>
      ) : (
        <ul className="tasks__list">
          {tasks.slice(0, 6).map((t, i) => (
            <li key={t.task_id} className="task" style={{ '--i': i }}>
              <div className="task__row">
                <span className="task__text">{t.task_description}</span>
                <span className="task__pct">{t.composite_exposure.toFixed(2)}</span>
              </div>
              <span className="task__track">
                <span
                  className="task__fill"
                  style={{ width: `${Math.round(t.composite_exposure * 100)}%` }}
                />
              </span>
              <span className="task__source">{sourceLine(t)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The citation under each task — what actually produced that number. */
function sourceLine(t) {
  const ei = t.has_economic_index
    ? `Economic Index: ${t.economic_index_label}`
    : 'Economic Index: not observed'
  return `${ei} · β ${t.eloundou_beta.toFixed(2)} · importance ${t.onet_importance.toFixed(1)}`
}

/** The finding, in words, before any chart. */
function lede(resilience, atRisk, holding) {
  const total = atRisk.length + holding.length
  const n = atRisk.length
  if (total === 0) return 'No task data is available for this occupation.'
  if (n === 0) {
    return `None of your ${total} tasks currently sit above the 0.5 exposure line. That is unusual, and worth re-reading when the Economic Index next updates.`
  }
  if (n === total) {
    return `All ${total} of your tasks sit above the 0.5 exposure line. The pressure here is not concentrated in one part of the job — it runs across the whole of it.`
  }
  return `${n} of your ${total} tasks sit above the 0.5 exposure line, and ${total - n} do not. That split is the shape of your plan.`
}
