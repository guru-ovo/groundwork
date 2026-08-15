import { useState } from 'react'
import { resolveOccupation, getResilience, getRoadmap } from './api'
import ResilienceGauge from './components/ResilienceGauge'
import TaskBreakdown from './components/TaskBreakdown'
import Roadmap from './components/Roadmap'
import Logo from './components/Logo'

export default function App() {
  const [title, setTitle] = useState('')
  const [matches, setMatches] = useState([])
  const [resilience, setResilience] = useState(null)
  const [roadmap, setRoadmap] = useState(null)
  const [skillsInput, setSkillsInput] = useState('')
  const [status, setStatus] = useState('idle') // idle | resolving | scoring | error

  async function handleSearch(e) {
    e.preventDefault()
    setStatus('resolving')
    setResilience(null)
    setRoadmap(null)
    try {
      const result = await resolveOccupation(title)
      setMatches(result.matches || [])
      setStatus('idle')
    } catch (err) {
      setStatus('error')
    }
  }

  async function handleSelect(socCode) {
    setStatus('scoring')
    try {
      const data = await getResilience(socCode)
      setResilience(data)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
    }
  }

  async function handleRoadmap() {
    if (!resilience) return
    const skills = skillsInput.split(',').map((s) => s.trim()).filter(Boolean)
    try {
      const data = await getRoadmap(resilience.soc_code, skills)
      setRoadmap(data.roadmap)
    } catch (err) {
      setStatus('error')
    }
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

      <form onSubmit={handleSearch} className="search">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Junior Data Analyst"
        />
        <button type="submit">Search</button>
      </form>

      {status === 'resolving' && <p className="status">Matching occupation…</p>}

      {matches.length > 0 && !resilience && (
        <ul className="matches">
          {matches.map((m) => (
            <li key={m.soc_code}>
              <button onClick={() => handleSelect(m.soc_code)}>
                {m.title} <span className="matches__code">{m.soc_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {status === 'scoring' && <p className="status">Scoring against real data…</p>}

      {resilience && (
        <section className="results">
          <ResilienceGauge
            score={resilience.resilience_score}
            occupationTitle={resilience.occupation_title}
          />
          <TaskBreakdown
            atRiskTasks={resilience.at_risk_tasks}
            resilientTasks={resilience.resilient_tasks}
          />

          <div className="skills">
            <label>Your current skills (comma separated)</label>
            <input
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g. SQL, dashboarding, stakeholder presentations"
            />
            <button onClick={handleRoadmap}>Generate roadmap</button>
          </div>

          <Roadmap items={roadmap} />
        </section>
      )}

      {status === 'error' && (
        <p className="status status--error">
          Something went wrong. Check that the backend is running on
          localhost:8000.
        </p>
      )}
    </div>
  )
}
