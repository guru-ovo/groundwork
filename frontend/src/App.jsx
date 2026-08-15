import { useState } from 'react'
import QuestionnaireFlow from './questionnaire/QuestionnaireFlow'
import AgentTimeline from './components/AgentTimeline'
import PlanPhases from './components/PlanPhases'
import DataConfidence from './components/DataConfidence'
import ResilienceGauge from './components/ResilienceGauge'
import Logo from './components/Logo'
import { usePlanStream } from './hooks/usePlanStream'
import { getResilience } from './api'

export default function App() {
  const { steps, phase, reading, plan, status, error, start, reset } = usePlanStream()
  const [answers, setAnswers] = useState(null)
  const [resilience, setResilience] = useState(null)

  function handleSubmit(payload, submitted) {
    setAnswers(submitted)
    // Fetch the grounded score alongside the agent run rather than after it.
    // It is pure computation and returns in milliseconds, so the reader sees
    // a real number immediately instead of watching a spinner for 20 seconds.
    getResilience(payload.soc_code).then(setResilience).catch(() => setResilience(null))
    start(payload)
  }

  function startOver() {
    setAnswers(null)
    setResilience(null)
    reset()
  }

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__eyebrow app__eyebrow--brand">
          <Logo size={18} /> Groundwork
        </span>
        <h1>What's actually changing in your field</h1>
        <p className="app__sub">
          Grounded in real O*NET task data, the Anthropic Economic Index, and
          Eloundou et al. exposure research — not a guess.
        </p>
      </header>

      {status === 'idle' && <QuestionnaireFlow onSubmit={handleSubmit} />}

      {status !== 'idle' && (
        <section className="results">
          {resilience && (
            <>
              <ResilienceGauge
                score={resilience.resilience_score}
                occupationTitle={resilience.occupation_title}
              />
              <DataConfidence
                coverage={resilience.economic_index_coverage}
                ratingsEstimated={resilience.ratings_estimated}
                taskCount={
                  resilience.at_risk_tasks.length + resilience.resilient_tasks.length
                }
              />
            </>
          )}

          <AgentTimeline
            steps={steps}
            phase={phase}
            reading={reading}
            running={status === 'running'}
          />

          <PlanPhases plan={plan} occupationTitle={answers?.occupationTitle} />

          {error && <p className="status status--error">{error}</p>}

          {status !== 'running' && (
            <div>
              <button type="button" onClick={startOver}>Start over</button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
