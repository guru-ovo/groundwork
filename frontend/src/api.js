const BASE_URL = 'http://localhost:8000'

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
