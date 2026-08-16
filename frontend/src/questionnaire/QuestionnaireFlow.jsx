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
import InterestsStep from './steps/InterestsStep'
import TimeStep from './steps/TimeStep'
import GoalStep from './steps/GoalStep'
import ReviewStep from './steps/ReviewStep'
import MatchPanel from './MatchPanel'
import Logo from '../components/Logo'
import './Questionnaire.css'

const STEP_COMPONENTS = {
  role: RoleStep,
  skills: SkillsStep,
  values: ValuesStep,
  interests: InterestsStep,
  time: TimeStep,
  goal: GoalStep,
  review: ReviewStep,
}

/** The eyebrow above each step's heading. Presentation only — schema.js owns ids. */
const STEP_EYEBROWS = {
  role: 'Your role',
  skills: 'What you can do',
  values: 'Work values',
  interests: 'Interests',
  time: 'Time and budget',
  goal: 'Direction',
  review: 'Check this over',
}

const STEP_LEDES = {
  role:
    "Type it how you'd say it out loud. We'll match it to an O*NET occupation — " +
    'that match is what the whole measurement hangs on, so check it.',
  skills:
    'List what you can do today. The plan will not tell you to learn something ' +
    'you already have.',
  values:
    "Pick two. These are O*NET's own six work values, so your answer is citable " +
    'rather than invented.',
  interests:
    'The only question here about what you would enjoy rather than what you can ' +
    "do. Six RIASEC dimensions on O*NET's 1–7 scale — it publishes the same six " +
    'measures for every occupation, so the fit is measured, not guessed. Leave ' +
    'one in the middle and it reads as no strong preference.',
  time:
    'Milestones get sized against this, so a plan for two hours a week is not the ' +
    'same plan scaled down.',
  goal: 'This decides whether the plan holds you in place or moves you.',
  review: 'Everything below is what gets measured. Change anything that is wrong.',
}

/**
 * The questionnaire, as a split shell.
 *
 * Form on the left at a readable measure; on the right, what is already known
 * about the chosen occupation. The right panel is not decoration — it makes
 * the consequences of the match visible while it can still be changed.
 */
export default function QuestionnaireFlow({ onSubmit }) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState(emptyAnswers)
  const [showErrors, setShowErrors] = useState(false)
  // Owned here, not by RoleStep: the candidate list has to outlive that
  // component being unmounted when the user steps away and back.
  const [matches, setMatches] = useState([])

  const stepId = STEP_IDS[index]
  const StepComponent = STEP_COMPONENTS[stepId]
  const errors = validateStep(stepId, answers)
  const isLast = index === STEP_IDS.length - 1
  const total = STEP_IDS.length

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

  function back() {
    setShowErrors(false)
    setIndex((i) => Math.max(0, i - 1))
  }

  const pad = (n) => String(n).padStart(2, '0')

  return (
    <section className="qn" aria-labelledby="qn-title">
      <div className="qn__form">
        <div className="qn__chrome">
          <Logo size={18} />
          <ol className="qn__progress" aria-label={`Step ${index + 1} of ${total}`}>
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
          <span className="qn__counter">{pad(index + 1)} / {pad(total)}</span>
        </div>

        <span className="qn__eyebrow">
          {pad(index + 1)} / {pad(total)} · {STEP_EYEBROWS[stepId]}
        </span>
        <h2 id="qn-title" className="qn__title">{STEP_TITLES[stepId]}</h2>
        {STEP_LEDES[stepId] && <p className="qn__lede">{STEP_LEDES[stepId]}</p>}

        <StepComponent
          answers={answers}
          update={update}
          matches={matches}
          setMatches={setMatches}
        />

        {showErrors && errors.length > 0 && (
          <ul className="qn__errors" role="alert">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        <div className="qn__nav">
          <button type="button" className="qn__back" onClick={back} disabled={index === 0}>
            Back
          </button>
          <div className="qn__nav-end">
            <span className="qn__enter" aria-hidden="true">Enter ↵</span>
            <button type="button" className="qn__next" onClick={next}>
              {isLast ? 'Build my plan' : `${STEP_EYEBROWS[STEP_IDS[index + 1]]} next`}
            </button>
          </div>
        </div>
      </div>

      <MatchPanel socCode={answers.socCode} occupationTitle={answers.occupationTitle} />
    </section>
  )
}
