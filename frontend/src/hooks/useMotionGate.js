import { useEffect } from 'react'

/**
 * Prove the timeline is live before letting anything start invisible.
 *
 * Entrance animations begin at `opacity: 0`. If the animation never runs —
 * reduced motion, a paused tab, a print, a screenshot, an engine that doesn't
 * support what the keyframe asks for — that opacity is where the content
 * stays, and the page silently ships blank sections.
 *
 * So the entrance keyframes are gated behind `html.gw-motion`, and this hook
 * adds that class only from inside a real `requestAnimationFrame` callback.
 * A frame having actually run is the proof; nothing else is.
 *
 * The gate is structural, not a list: the CSS keys off the `gw-` keyframe
 * prefix, so a new entrance animation is covered the moment it is written.
 * Ambient loops use the `amb-` prefix, never hide anything, and always run.
 */
export function useMotionGate() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    const id = requestAnimationFrame(() => {
      document.documentElement.classList.add('gw-motion')
    })
    return () => cancelAnimationFrame(id)
  }, [])
}
