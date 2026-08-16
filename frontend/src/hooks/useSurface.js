import { useLayoutEffect } from 'react'

/**
 * Put the active surface on <html>.
 *
 * The two palettes are alternatives, not layers: `App.css` declares Direction A
 * on `:root` and Direction B under `html[data-surface="paper"]`, both using the
 * same semantic token names. Switching the attribute switches the whole page —
 * including the document background and the overscroll gutter, which a wrapper
 * div cannot reach.
 *
 * Setting it here rather than on a container is what keeps the handoff's one
 * hard rule enforceable: never mix the two within a single surface.
 *
 * Deliberately useLayoutEffect, not useEffect. A plain effect runs *after*
 * the browser has painted, so the landing route rendered one frame in the
 * dark product palette before flipping to paper — a visible flash of the
 * wrong theme on every load, and worse on a slow device. A layout effect
 * runs before paint, so the first frame the reader sees is already correct.
 *
 * @param {'paper' | null} surface  null restores Direction A (the product).
 */
export function useSurface(surface) {
  useLayoutEffect(() => {
    const root = document.documentElement
    if (surface) root.setAttribute('data-surface', surface)
    else root.removeAttribute('data-surface')

    return () => root.removeAttribute('data-surface')
  }, [surface])
}
