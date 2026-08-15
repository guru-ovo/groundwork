import { useState } from 'react'
import QuestionnaireFlow from './questionnaire/QuestionnaireFlow'
import AgentTimeline from './components/AgentTimeline'
import PlanPhases from './components/PlanPhases'
import Logo from './components/Logo'
import { usePlanStream } from './hooks/usePlanStream'

export default function App() {
  const { steps, phase, reading, plan, status, error, start, reset } = usePlanStream()
  const [answers, setAnswers] = useState(null)

  function handleSubmit(payload, submitted) {
    setAnswers(submitted)
    start(payload)
  }

  function startOver() {
    setAnswers(null)
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
          {answers && (
            <p className="status">
              {answers.occupationTitle} · {answers.skills.length}{' '}
              {answers.skills.length === 1 ? 'skill' : 'skills'} listed
            </p>
          )}

          <AgentTimeline
            steps={steps}
            phase={phase}
            reading={reading}
            running={status === 'running'}
          />

          <PlanPhases plan={plan} />

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
