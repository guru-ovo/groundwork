import { HOURS_OPTIONS, BUDGET_OPTIONS, GOAL_OPTIONS, WORK_VALUES } from '../schema'

function labelFor(options, value) {
  return options.find((o) => o.value === value)?.label ?? 'Not set'
}

export default function ReviewStep({ answers }) {
  const values = answers.workValues.map((v) => labelFor(WORK_VALUES, v))

  return (
    <div className="qn__step">
      <dl className="qn__review">
        <dt>Role</dt>
        <dd>
          {answers.occupationTitle || 'Not set'}{' '}
          <span className="qn__meta">{answers.socCode}</span>
        </dd>

        <dt>Skills</dt>
        <dd>{answers.skills.length ? answers.skills.join(', ') : 'None listed'}</dd>

        <dt>Values</dt>
        <dd>{values.length ? values.join(', ') : 'None chosen'}</dd>

        <dt>Time</dt>
        <dd>{labelFor(HOURS_OPTIONS, answers.hours)}</dd>

        <dt>Budget</dt>
        <dd>{labelFor(BUDGET_OPTIONS, answers.budget)}</dd>

        <dt>Direction</dt>
        <dd>{labelFor(GOAL_OPTIONS, answers.goalType)}</dd>

        {answers.goalNote.trim() && (
          <>
            <dt>Your words</dt>
            <dd>{answers.goalNote}</dd>
          </>
        )}
      </dl>
    </div>
  )
}
