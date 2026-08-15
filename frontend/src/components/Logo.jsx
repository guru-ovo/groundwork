export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle
        cx="20" cy="20" r="16" fill="none" stroke="var(--moss)" strokeWidth="4"
        strokeLinecap="round" strokeDasharray="75.4 100.53"
        transform="rotate(-90 20 20)"
      />
      <circle cx="20" cy="4" r="3" fill="var(--amber)" />
    </svg>
  )
}
