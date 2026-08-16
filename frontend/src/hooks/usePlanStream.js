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
  // Kept so the plan can be retried on its own. The score is computed
  // separately and must survive a failed run untouched, so retrying has to
  // mean "run the agent again", never "start the whole measurement again".
  const payloadRef = useRef(null)

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
    payloadRef.current = payload

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

  /** Re-run only the agent. Anything already computed stays as it is. */
  const retry = useCallback(() => {
    if (payloadRef.current) start(payloadRef.current)
  }, [start])

  /**
   * Give up on the plan and keep what was measured.
   *
   * Clears the error without clearing the score, so the report renders with
   * its numbers and no written plan — which is honest, because the numbers
   * never needed the model in the first place.
   */
  const dismissError = useCallback(() => {
    setError(null)
    setStatus('done')
  }, [])

  return { steps, phase, reading, plan, status, error, start, reset, retry, dismissError }
}
