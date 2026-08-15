import { useEffect, useState } from 'react'
import { INTEREST_KEYS, INTEREST_DEFAULT } from '../schema'
import { getInterestQuestions } from '../../api'

/**
 * RIASEC interest self-rating.
 *
 * Every other question in this form is about capability — what you do, what
 * you know, how much time you have. This one is the only question about
 * whether you would actually want the work, and O*NET publishes the matching
 * profile for all 922 occupations, so the fit is measured rather than
 * guessed.
 *
 * Prompts come from the API rather than being duplicated here: the scorer
 * and the questionnaire read the same constant, so a renamed dimension
 * cannot silently stop matching.
 */

// Shown if the API is unreachable. Wording matches the server's constants —
// a degraded form is far better than a blocked one.
const FALLBACK_PROMPTS = {
  realistic: 'Working with your hands, tools, machines, or outdoors',
  investigative: 'Figuring out why something works the way it does',
  artistic: 'Making something original, where there is no single right answer',
  social: 'Teaching, advising, or helping people directly',
  enterprising: 'Persuading people, leading a push, taking a risk on an idea',
  conventional: 'Bringing order to something messy, with clear rules and accuracy',
}

export default function InterestsStep({ answers, update }) {
  const [prompts, setPrompts] = useState(FALLBACK_PROMPTS)
  const [scale, setScale] = useState({
    min: 1, max: 7, min_label: 'Not for me', max_label: 'Very much me',
  })

  useEffect(() => {
    getInterestQuestions()
      .then((data) => {
        setPrompts(Object.fromEntries(data.dimensions.map((d) => [d.key, d.prompt])))
        setScale(data.scale)
      })
      .catch(() => {})
  }, [])

  function setValue(key, value) {
    update({ interests: { ...answers.interests, [key]: Number(value) } })
  }

  return (
    <div className="qn__step">
      <p className="qn__hint">
        How much does each of these sound like you? This is the only question
        here about what you'd enjoy rather than what you can do — O*NET
        publishes the same six measures for every occupation, so the match is
        measured, not guessed.
      </p>

      <ul className="interests">
        {INTEREST_KEYS.map((key) => {
          const value = answers.interests?.[key] ?? INTEREST_DEFAULT
          return (
            <li key={key} className="interests__item">
              <label className="interests__prompt" htmlFor={`interest-${key}`}>
                {prompts[key] ?? key}
              </label>
              <div className="interests__control">
                <span className="interests__end">{scale.min_label}</span>
                <input
                  id={`interest-${key}`}
                  type="range"
                  min={scale.min}
                  max={scale.max}
                  step={1}
                  value={value}
                  onChange={(e) => setValue(key, e.target.value)}
                  aria-describedby={`interest-${key}-value`}
                />
                <span className="interests__end">{scale.max_label}</span>
                <output id={`interest-${key}-value`} className="interests__value">
                  {value}
                </output>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
