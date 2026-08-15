import { HOURS_OPTIONS, BUDGET_OPTIONS } from '../schema'

function RadioGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="qn__fieldset">
      <legend className="qn__label">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="qn__radio">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

export default function TimeStep({ answers, update }) {
  return (
    <div className="qn__step">
      <p className="qn__hint">
        This changes the plan itself, not just its deadline.
      </p>
      <RadioGroup
        legend="Time you can give this"
        name="hours"
        options={HOURS_OPTIONS}
        value={answers.hours}
        onChange={(hours) => update({ hours })}
      />
      <RadioGroup
        legend="Budget"
        name="budget"
        options={BUDGET_OPTIONS}
        value={answers.budget}
        onChange={(budget) => update({ budget })}
      />
    </div>
  )
}
