import { useCallback, useRef, useState } from 'react'
import { streamCareerPlan } from '../api'

/**
 * Drives one agent run.
 *
 * Steps accumulate as they arrive so the interface can show the agent
 * working rather than a spinner — the run takes 15-25 seconds because each
 * step is a real model call over real tool output.
 */
export function usePlanStream() {
  const [steps, setSteps] = useState([])
  const [phase, setPhase] = useState('')
  const [reading, setReading] = useState(null)
  const [plan, setPlan] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setSteps([])
    setPhase('')
    setReading(null)
    setPlan(null)
    setError(null)
    setStatus('idle')
  }, [])

  const start = useCallback(async (payload) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSteps([])
    setPhase('')
    setReading(null)
    setPlan(null)
    setError(null)
    setStatus('running')

    try {
      await streamCareerPlan(
        payload,
        (event) => {
          if (event.type === 'step') setSteps((prev) => [...prev, event])
          else if (event.type === 'phase') setPhase(event.label)
          else if (event.type === 'analysis') setReading(event.reading)
          else if (event.type === 'final') setPlan(event.plan)
          else if (event.type === 'error') setError(event.message)
        },
        controller.signal,
      )
      setStatus((prev) => (prev === 'running' ? 'done' : prev))
    } catch (err) {
      if (err.name === 'AbortError') return
      setError('The planner could not be reached. It may be waking up — try again in a moment.')
      setStatus('error')
    }
  }, [])

  return { steps, phase, reading, plan, status, error, start, reset }
}
