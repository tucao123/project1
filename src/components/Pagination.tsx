import { env, type ViewId } from '../config/env'

export function Pagination({
  views,
  active,
  busy = false,
  onNavigate,
}: {
  views: ViewId[]
  active: ViewId
  busy?: boolean
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
          aria-busy={busy}
          onClick={() => onNavigate(v)}
        >
          {env.views.labels[v]}
        </button>
      ))}
    </div>
  )
}
