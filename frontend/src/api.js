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

export async function getRoadmap(socCode, studentSkills) {
  const res = await fetch(`${BASE_URL}/roadmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ soc_code: socCode, student_skills: studentSkills }),
  })
  if (!res.ok) throw new Error('Could not generate roadmap')
  return res.json()
}
