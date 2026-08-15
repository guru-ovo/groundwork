export default function ResilienceGauge({ score, occupationTitle }) {
  const tone =
    score >= 66 ? 'var(--moss)' : score >= 40 ? 'var(--amber)' : 'var(--clay)'

  return (
    <div className="gauge">
      <div className="gauge__ring" style={{ '--tone': tone, '--pct': score }}>
        <span className="gauge__score">{score}</span>
      </div>
      <div className="gauge__label">
        <span className="gauge__eyebrow">Resilience score</span>
        <h2>{occupationTitle}</h2>
      </div>
    </div>
  )
}
