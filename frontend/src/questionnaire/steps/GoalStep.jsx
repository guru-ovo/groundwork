import { GOAL_OPTIONS } from '../schema'

export default function GoalStep({ answers, update }) {
  return (
    <div className="qn__step">
      <fieldset className="qn__fieldset">
        <legend className="qn__label">Direction</legend>
        {GOAL_OPTIONS.map((option) => (
          <label key={option.value} className="qn__radio">
            <input
              type="radio"
              name="goalType"
              value={option.value}
              checked={answers.goalType === option.value}
              onChange={() => update({ goalType: option.value })}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <div>
        <label className="qn__label" htmlFor="qn-goal-note">
          In your own words (optional)
        </label>
        <textarea
          id="qn-goal-note"
          rows={3}
          value={answers.goalNote}
          onChange={(e) => update({ goalNote: e.target.value })}
          placeholder="e.g. I'm tired of rebuilding the same reports every week"
        />
      </div>
    </div>
  )
}
