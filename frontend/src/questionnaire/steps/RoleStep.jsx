import { useState } from 'react'
import { resolveOccupation } from '../../api'

/**
 * Step 1 — resolve a typed title to an O*NET occupation.
 *
 * The candidate list is owned by QuestionnaireFlow, not by this component.
 * It used to be a `useState` here, which meant stepping Back unmounted it and
 * wiped the list — the user returned to their own title with no visible
 * selection, while `socCode` was still quietly set. The match is the
 * foundation of the entire measurement, so it is never hidden: if a choice has
 * been made, the list that shows it must survive navigation.
 *
 * It is deliberately NOT part of `answers`: schema.js is the contract for what
 * the user answered, and a list of candidates the server returned is neither
 * an answer nor part of the request payload.
 */
export default function RoleStep({ answers, update, matches, setMatches }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [searched, setSearched] = useState(false)

  async function search(e) {
    e.preventDefault()
    const title = answers.title.trim()
    if (!title) return

    setBusy(true)
    setFailed(false)
    try {
      const result = await resolveOccupation(title)
      setMatches(result.matches || [])
      setSearched(true)
    } catch {
      setFailed(true)
      setMatches([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qn__step">
      <form onSubmit={search} className="qn__resolve">
        <label className="qn__label" htmlFor="qn-title-input">Your job title</label>
        <div className="qn__row">
          <input
            id="qn-title-input"
            value={answers.title}
            autoComplete="organization-title"
            onChange={(e) => {
              // Changing the title invalidates the match it produced.
              update({ title: e.target.value, socCode: '', occupationTitle: '' })
              setMatches([])
              setSearched(false)
            }}
            placeholder="e.g. Junior Data Analyst"
          />
          <button type="submit" disabled={busy}>{busy ? 'Matching' : 'Match'}</button>
        </div>
      </form>

      {failed && (
        <p className="qn__hint" role="status">
          Matching is unavailable right now. Try again in a moment — nothing you
          have typed is lost.
        </p>
      )}

      {busy && !matches.length && (
        <div className="qn__skeleton" aria-hidden="true">
          {['64%', '48%', '57%'].map((w, i) => (
            <span key={w} className="skeleton-bar" style={{ width: w, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      )}

      {matches.length > 0 && (
        <>
          <span className="mono-label qn__candidates">
            {matches.length} candidate{matches.length === 1 ? '' : 's'} · pick the closest
          </span>
          <ul className="qn__choices">
            {matches.map((m, i) => {
              const on = answers.socCode === m.soc_code
              return (
                <li key={m.soc_code}>
                  <button
                    type="button"
                    className={'qn__match' + (on ? ' qn__match--on' : '')}
                    aria-pressed={on}
                    style={{ '--i': i }}
                    onClick={() => update({ socCode: m.soc_code, occupationTitle: m.title })}
                  >
                    <span className="qn__match-body">
                      <span className="qn__match-title">{m.title}</span>
                      <span className="qn__match-note">
                        {on ? 'Selected — the whole measurement hangs on this' : 'O*NET occupation'}
                      </span>
                    </span>
                    <span className="qn__match-meta">
                      <span className="qn__match-soc">{m.soc_code}</span>
                      <span className={'qn__match-conf qn__match-conf--' + m.confidence}>
                        {m.confidence}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* A7 empty state: searched, nothing usable came back. */}
      {searched && matches.length === 0 && !busy && !failed && (
        <div className="state state--empty">
          <span className="mono-label">No match</span>
          <span className="state__strata" aria-hidden="true">
            <span /><span /><span />
          </span>
          <h3>O*NET has never heard of that title</h3>
          <p>
            It&apos;s usually a company-specific name. Try the plainest version
            of what you actually do — &ldquo;analyst&rdquo;,
            &ldquo;producer&rdquo;, &ldquo;operations&rdquo;.
          </p>
        </div>
      )}
    </div>
  )
}
