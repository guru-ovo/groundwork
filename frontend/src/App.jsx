import { useState } from 'react'
import { Link } from 'react-router-dom'
import QuestionnaireFlow from './questionnaire/QuestionnaireFlow'
import AgentTimeline from './components/AgentTimeline'
import DataConfidence from './components/DataConfidence'
import ResilienceGauge from './components/ResilienceGauge'
import ResultsReport from './components/ResultsReport'
import TaskBreakdown from './components/TaskBreakdown'
import PlanFailure from './components/PlanFailure'
import ScoreSkeleton from './components/ScoreSkeleton'
import Logo from './components/Logo'
import { usePlanStream } from './hooks/usePlanStream'
import { useSurface } from './hooks/useSurface'
import { getResilience } from './api'

/**
 * The product.
 *
 * The central behaviour here is that **the score resolves independently of the
 * agent**. `/tasks/{soc}` is pure computation and answers in milliseconds; the
 * agent run takes 15-25 seconds. So the gauge and the confidence panel render
 * as soon as the number lands, and the agent's reasoning fills in around them.
 *
 * The corollary matters just as much: `plan` is the only LLM-dependent state,
 * and nothing in this component clears `resilience` when the plan fails. A
 * model timeout costs the reader the written plan and nothing else, because
 * the number never needed the model to be true.
 */
export default function App() {
  useSurface(null) // Direction A — the product is the dark surface.

  const { steps, phase, reading, plan, status, error, start, reset, retry, dismissError } =
    usePlanStream()

  const [answers, setAnswers] = useState(null)
  const [resilience, setResilience] = useState(null)
  const [scoreState, setScoreState] = useState('idle')
  const [weeklyHours, setWeeklyHours] = useState(null)

  function handleSubmit(payload, submitted) {
    setAnswers(submitted)
    setWeeklyHours(payload.weekly_hours)
    setScoreState('loading')

    // Fired alongside the agent run, not after it.
    getResilience(payload.soc_code)
      .then((data) => { setResilience(data); setScoreState('ready') })
      .catch(() => setScoreState('failed'))

    start(payload)
  }

  function startOver() {
    setAnswers(null)
    setResilience(null)
    setScoreState('idle')
    setWeeklyHours(null)
    reset()
  }

  const running = status === 'running'
  const finished = status === 'done' || status === 'error'

  return (
    <div className={'app' + (status === 'idle' ? ' app--intro' : '')}>
      {status === 'idle' && (
        <header className="app__header">
          <Link to="/" className="app__eyebrow app__eyebrow--brand">
            <Logo size={18} /> Groundwork
          </Link>
          <h1>What&apos;s actually changing in your field</h1>
          <p className="app__sub">
            Grounded in real O*NET task data, the Anthropic Economic Index, and
            Eloundou et al. exposure research — not a guess.
          </p>
        </header>
      )}

      {status === 'idle' && <QuestionnaireFlow onSubmit={handleSubmit} />}

      {status !== 'idle' && (
        <section className="run">
          {/* Left: the computed half. Present as soon as it exists. */}
          <div className={'run__score' + (running ? ' run__score--live' : '')}>
            {running && <span className="run__sweep" aria-hidden="true" />}

            {scoreState === 'loading' && <ScoreSkeleton />}

            {scoreState === 'failed' && (
              <p className="status status--error">
                The task data could not be loaded. The agent may still produce a
                plan, but the measured score is missing.
              </p>
            )}

            {scoreState === 'ready' && resilience && (
              <>
                <ResilienceGauge
                  score={resilience.resilience_score}
                  occupationTitle={resilience.occupation_title}
                  socCode={resilience.soc_code}
                />
                <DataConfidence
                  coverage={resilience.economic_index_coverage}
                  ratingsEstimated={resilience.ratings_estimated}
                  taskCount={
                    resilience.at_risk_tasks.length + resilience.resilient_tasks.length
                  }
                />
                <p className="run__caption">
                  The number was already true before the agent started. What it
                  is doing now is explaining it and building you a plan.
                </p>
              </>
            )}
          </div>

          {/* Right: the model-dependent half. */}
          <div className="run__stream">
            {running && (
              <AgentTimeline steps={steps} phase={phase} reading={reading} running />
            )}

            {error && (
              <PlanFailure
                message={error}
                score={resilience?.resilience_score}
                onRetry={retry}
                onDismiss={dismissError}
              />
            )}

            {finished && !error && (
              <>
                <ResultsReport
                  resilience={resilience}
                  plan={plan}
                  weeklyHours={weeklyHours}
                  onStartOver={startOver}
                />
              </>
            )}

            {finished && error && resilience && (
              <>
                <ResultsReport resilience={resilience} plan={null} weeklyHours={weeklyHours} onStartOver={startOver} />
              </>
            )}
          </div>

          {/* Six columns of numerics do not fit the stream column. The table
              spans the whole card instead, where it can be read across. */}
          {finished && resilience && (
            <div className="run__wide">
              <TaskBreakdown resilience={resilience} />
            </div>
          )}

          {finished && (
            <div className="run__foot">
              <button type="button" className="btn-quiet" onClick={startOver}>
                Start over
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
