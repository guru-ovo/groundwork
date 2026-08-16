/**
 * The Groundwork mark: a vertical stake with two angled strata.
 *
 * A survey stake driven into ground, the strata reading off it like layers in
 * a core sample — the product's whole argument in one shape.
 *
 * Colour comes from the surface, not from here. The stake and the near
 * stratum take `currentColor`, so the mark inherits whatever text colour it
 * sits in; the far stratum takes `--logo-accent`, which is amber on the dark
 * product surface and plain ink on the landing, where the palette carries no
 * accent hue at all.
 */
export default function Logo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 4v32" stroke="currentColor" strokeWidth="2.5" />
      <path d="M20 14 8 20v8l12-6z" fill="currentColor" opacity=".45" />
      <path d="M20 14l12 6v8l-12-6z" fill="var(--logo-accent, var(--amber))" />
    </svg>
  )
}
