import { createSSEParser } from './lib/sse'

// Set VITE_API_URL in Vercel's project env vars to the deployed backend URL.
// Falls back to the local uvicorn default so `npm run dev` works untouched.
// Trailing slashes are stripped so `${BASE_URL}/path` never doubles up.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

export async function resolveOccupation(title) {
  const res = await fetch(`${BASE_URL}/resolve-occupation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Could not resolve occupation')
  return res.json()
}

export async function getResilience(socCode) {
  const res = await fetch(`${BASE_URL}/tasks/${encodeURIComponent(socCode)}`)
  if (!res.ok) throw new Error('Could not load resilience data')
  return res.json()
}

/**
 * POST the questionnaire and read the agent's events as they arrive.
 *
 * fetch rather than EventSource: EventSource is GET-only and this request
 * carries a body. onEvent fires once per event; the promise resolves when
 * the stream closes.
 */
export async function streamCareerPlan(payload, onEvent, signal) {
  const res = await fetch(`${BASE_URL}/career-plan/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok || !res.body) throw new Error('Could not start the planner')

  const push = createSSEParser(onEvent)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    push(decoder.decode(value, { stream: true }))
  }
}

export async function getRoadmap(socCode, studentSkills) {
  const res = await fetch(`${BASE_URL}/roadmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ soc_code: socCode, student_skills: studentSkills }),
  })
  if (!res.ok) throw new Error('Could not generate roadmap')
  return res.json()
}
