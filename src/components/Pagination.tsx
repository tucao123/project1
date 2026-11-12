import { env, type ViewId } from '../config/env'

export function Pagination({
  views,
  active,
  onNavigate,
}: {
  views: ViewId[]
  active: ViewId
  onNavigate: (v: ViewId) => void
}) {
  return (
    <div className="pagination">
      {views.map((v) => (
        <button
          type="button"
          key={v}
          className={`page-btn${v === active ? ' active' : ''}`}
          data-target={v}
          onClick={() => onNavigate(v)}
        >
          {env.views.labels[v]}
        </button>
      ))}
    </div>
  )
}
