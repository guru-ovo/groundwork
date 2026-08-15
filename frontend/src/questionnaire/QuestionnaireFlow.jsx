import { useState } from 'react'
import {
  STEP_IDS,
  STEP_TITLES,
  emptyAnswers,
  validateStep,
  toRequestPayload,
} from './schema'
import RoleStep from './steps/RoleStep'
import SkillsStep from './steps/SkillsStep'
import ValuesStep from './steps/ValuesStep'
import TimeStep from './steps/TimeStep'
import GoalStep from './steps/GoalStep'
import ReviewStep from './steps/ReviewStep'
import './Questionnaire.css'

const STEP_COMPONENTS = {
  role: RoleStep,
  skills: SkillsStep,
  values: ValuesStep,
  time: TimeStep,
  goal: GoalStep,
  review: ReviewStep,
}

export default function QuestionnaireFlow({ onSubmit }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState(emptyAnswers)
  const [showErrors, setShowErrors] = useState(false)

  const stepId = STEP_IDS[index]
  const StepComponent = STEP_COMPONENTS[stepId]
  const errors = validateStep(stepId, answers)
  const isLast = index === STEP_IDS.length - 1

  function update(patch) {
    setAnswers((prev) => ({ ...prev, ...patch }))
    setShowErrors(false)
  }

  function next() {
    if (errors.length > 0) {
      setShowErrors(true)
      return
    }
    if (isLast) onSubmit(toRequestPayload(answers), answers)
    else setIndex((i) => i + 1)
  }

  return (
    <section className="qn" aria-labelledby="qn-title">
      <ol className="qn__progress" aria-label={`Step ${index + 1} of ${STEP_IDS.length}`}>
        {STEP_IDS.map((id, i) => (
          <li
            key={id}
            className={
              'qn__tick' +
              (i === index ? ' qn__tick--current' : '') +
              (i < index ? ' qn__tick--done' : '')
            }
            aria-current={i === index ? 'step' : undefined}
          />
        ))}
      </ol>

      <h2 id="qn-title" className="qn__title">{STEP_TITLES[stepId]}</h2>

      <StepComponent answers={answers} update={update} />

      {showErrors && errors.length > 0 && (
        <ul className="qn__errors" role="alert">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="qn__nav">
        <button
          type="button"
          className="qn__back"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          Back
        </button>
        <button type="button" onClick={next}>
          {isLast ? 'Build my plan' : 'Continue'}
        </button>
      </div>
    </section>
  )
}
