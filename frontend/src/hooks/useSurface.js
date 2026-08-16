import { useEffect } from 'react'

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
 * @param {'paper' | null} surface  null restores Direction A (the product).
 */
export function useSurface(surface) {
  useEffect(() => {
    const root = document.documentElement
    if (surface) root.setAttribute('data-surface', surface)
    else root.removeAttribute('data-surface')

    return () => root.removeAttribute('data-surface')
  }, [surface])
}
