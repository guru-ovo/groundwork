import { useState } from 'react'
import { resolveOccupation } from '../../api'

export default function RoleStep({ answers, update }) {
  const [matches, setMatches] = useState([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function search(e) {
    e.preventDefault()
    if (!answers.title.trim()) return
    setBusy(true)
    setFailed(false)
    try {
      const result = await resolveOccupation(answers.title)
      setMatches(result.matches || [])
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qn__step">
      <form onSubmit={search}>
        <label className="qn__label" htmlFor="qn-title-input">Your job title</label>
        <div className="qn__row">
          <input
            id="qn-title-input"
            value={answers.title}
            onChange={(e) => {
              update({ title: e.target.value, socCode: '', occupationTitle: '' })
              setMatches([])
            }}
            placeholder="e.g. Junior Data Analyst"
          />
          <button type="submit" disabled={busy}>{busy ? 'Matching' : 'Find'}</button>
        </div>
      </form>

      {failed && (
        <p className="qn__hint">Matching is unavailable right now. Try again in a moment.</p>
      )}

      {matches.length > 0 && (
        <ul className="qn__choices">
          {matches.map((m) => (
            <li key={m.soc_code}>
              <button
                type="button"
                className={'qn__choice' + (answers.socCode === m.soc_code ? ' qn__choice--on' : '')}
                aria-pressed={answers.socCode === m.soc_code}
                onClick={() => update({ socCode: m.soc_code, occupationTitle: m.title })}
              >
                <span>{m.title}</span>
                <span className="qn__meta">{m.soc_code} · {m.confidence}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
