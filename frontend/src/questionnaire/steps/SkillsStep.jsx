import { useState } from 'react'

export default function SkillsStep({ answers, update }) {
  const [draft, setDraft] = useState('')

  function add(e) {
    e.preventDefault()
    const value = draft.trim()
    if (!value) return
    if (answers.skills.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    update({ skills: [...answers.skills, value] })
    setDraft('')
  }

  return (
    <div className="qn__step">
      <p className="qn__hint">
        List what you can do today. The plan will not tell you to learn
        something you already have.
      </p>

      <form onSubmit={add} className="qn__row">
        <label className="qn__sr" htmlFor="qn-skill-input">Add a skill</label>
        <input
          id="qn-skill-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. SQL"
        />
        <button type="submit">Add</button>
      </form>

      <ul className="qn__chips">
        {answers.skills.map((skill) => (
          <li key={skill}>
            <button
              type="button"
              className="qn__chip"
              onClick={() => update({ skills: answers.skills.filter((s) => s !== skill) })}
            >
              {skill}<span aria-hidden="true"> ×</span>
              <span className="qn__sr"> (remove)</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
