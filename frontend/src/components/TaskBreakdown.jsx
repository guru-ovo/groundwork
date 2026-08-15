function TaskRow({ task }) {
  return (
    <li className="task-row">
      <div className="task-row__bar">
        <div
          className="task-row__fill"
          style={{ width: `${task.composite_exposure * 100}%` }}
        />
      </div>
      <div className="task-row__text">
        <p>{task.task_description}</p>
        <span className="task-row__source">
          {task.economic_index_label} · β {task.eloundou_beta}
        </span>
      </div>
    </li>
  )
}

export default function TaskBreakdown({ atRiskTasks, resilientTasks }) {
  return (
    <div className="breakdown">
      <div className="breakdown__col">
        <h3>Shifting fastest</h3>
        <ul>
          {atRiskTasks.map((t) => (
            <TaskRow key={t.task_id} task={t} />
          ))}
        </ul>
      </div>
      <div className="breakdown__col">
        <h3>Holding steady</h3>
        <ul>
          {resilientTasks.map((t) => (
            <TaskRow key={t.task_id} task={t} />
          ))}
        </ul>
      </div>
    </div>
  )
}
