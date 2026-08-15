export default function Roadmap({ items }) {
  if (!items || items.length === 0) return null

  return (
    <div className="roadmap">
      <h3>Where to build next</h3>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            <p className="roadmap__action">{item.action}</p>
            <p className="roadmap__reason">{item.reason}</p>
            <span className="roadmap__source">{item.data_source}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
