import { useEffect, useState } from 'react'
import { brl } from '../lib/format'
import './Charts.css'

export default function DonutChart({ data, size = 176, thickness = 22, centerLabel, centerValue, legend = true, maxLegend = 5 }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const total = data.reduce((a, d) => a + d.value, 0)
  const r = (size - thickness) / 2
  const C = 2 * Math.PI * r
  const gap = data.length > 1 ? 3 : 0

  const description = data.map((d) => `${d.label} ${brl(d.value)}`).join(', ')
  const shown = data.slice(0, maxLegend)
  const rest = data.slice(maxLegend).reduce((a, d) => a + d.value, 0)

  return (
    <div className="donut">
      <div className="donut-figure" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Gastos por categoria: ${description || 'sem dados'}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {total > 0 &&
              data.map((d, i) => {
                const len = (d.value / total) * C
                const offset = data.slice(0, i).reduce((a, x) => a + (x.value / total) * C, 0)
                return (
                  <circle
                    key={d.id || d.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={d.color}
                    strokeWidth={thickness}
                    strokeLinecap="butt"
                    strokeDasharray={`${ready ? Math.max(len - gap, 0.01) : 0} ${C}`}
                    strokeDashoffset={-offset}
                    className="donut-seg"
                  />
                )
              })}
          </g>
        </svg>
        <div className="donut-center">
          {centerLabel && <span className="tiny muted strong">{centerLabel}</span>}
          {centerValue}
        </div>
      </div>
      {legend && data.length > 0 && (
        <ul className="chart-legend">
          {shown.map((d) => (
            <li key={d.id || d.label}>
              <span className="legend-dot" style={{ background: d.color }} />
              <span className="grow ellipsis">{d.label}</span>
              <span className="num strong">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </li>
          ))}
          {rest > 0 && (
            <li>
              <span className="legend-dot" style={{ background: 'var(--surface-2)' }} />
              <span className="grow">Outras</span>
              <span className="num strong">{Math.round((rest / total) * 100)}%</span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
