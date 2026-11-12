/** 单指标趋势：沿用白卡 + 黑线 + 酸绿节点的元现代配色 */
export function TrendLine({
  values,
  labels = [],
}: {
  values: number[]
  labels?: string[]
}) {
  const W = 320
  const H = 130
  const padX = 22
  const top = 12
  const bottom = 96
  const max = Math.max(...values, 1) * 1.15
  const points = values.map((v, i) => {
    const x = padX + (i * (W - 2 * padX)) / Math.max(1, values.length - 1)
    const y = top + (1 - v / max) * (bottom - top)
    return [x, y] as const
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `${padX},${bottom} ${line} ${W - padX},${bottom}`

  return (
    <svg
      className="trend-svg"
      viewBox={`0 0 ${W} ${H}`}
      style={{ height: 'auto' }}
      role="img"
      aria-label="单指标跨批次趋势"
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={padX}
          x2={W - padX}
          y1={top + f * (bottom - top)}
          y2={top + f * (bottom - top)}
          stroke="#E6E6E6"
          strokeDasharray="3 5"
        />
      ))}
      <polygon points={area} fill="#E4FF00" opacity="0.28" />
      <polyline points={line} fill="none" stroke="#121212" strokeWidth="2" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="5" fill="#E4FF00" stroke="#121212" strokeWidth="2" />
          <text x={x} y={y - 11} fontSize="9" fontWeight="600" fill="#121212" textAnchor="middle" fontFamily="Inter, sans-serif">
            {values[i]}
          </text>
          {labels[i] ? (
            <text x={x} y={H - 12} fontSize="9" fill="#8A8A8A" textAnchor="middle" fontFamily="Inter, sans-serif">
              {labels[i]}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  )
}
