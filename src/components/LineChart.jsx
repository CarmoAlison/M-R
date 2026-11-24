import { useEffect, useState } from 'react'
import { brl, brlShort } from '../lib/format'
import './Charts.css'

/** Linhas (evolução). Toque/clique numa coluna para ver os valores. */
export default function LineChart({ labels, series, height = 200 }) {
  const [ready, setReady] = useState(false)
  const [sel, setSel] = useState(null)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const W = 340
  const padL = 44
  const padR = 12
  const padT = 14
  const padB = 26
  const innerW = W - padL - padR
  const innerH = height - padT - padB
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const n = labels.length
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1))
  const y = (v) => padT + innerH * (1 - v / max)
  const ticks = [0, 0.5, 1]

  const path = (values) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const desc = labels.map((l, i) => `${l}: ${series.map((s) => `${s.name} ${brl(s.values[i])}`).join(', ')}`).join('; ')

  return (
    <div className="line-chart">
      <div className="chart-tooltip" aria-live="polite">
        {sel != null ? (
          <>
            <strong>{labels[sel]}</strong>
            {series.map((s) => (
              <span key={s.name}>
                <span className="legend-dot" style={{ background: s.color }} /> {s.name}: <b className="num">{brl(s.values[sel])}</b>
              </span>
            ))}
          </>
        ) : (
          <span className="muted small">Toque no gráfico para ver os valores</span>
        )}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={desc}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(max * t)} y2={y(max * t)} className="chart-grid" />
            <text x={padL - 6} y={y(max * t) + 4} className="chart-axis" textAnchor="end">
              {brlShort(max * t).replace(',00', '')}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={l + i} x={x(i)} y={height - 8} className="chart-axis" textAnchor="middle">
            {n > 8 && i % 2 ? '' : l}
          </text>
        ))}
        {sel != null && <line x1={x(sel)} x2={x(sel)} y1={padT} y2={padT + innerH} className="chart-guide" />}
        {series.map((s) => (
          <g key={s.name}>
            <path
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
              strokeDasharray="1"
              strokeDashoffset={ready ? 0 : 1}
              className="chart-line"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={sel === i ? 5.5 : 3.5} fill="var(--card)" stroke={s.color} strokeWidth="2.5" />
            ))}
          </g>
        ))}
        {labels.map((l, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - innerW / Math.max(n - 1, 1) / 2}
            y={padT}
            width={innerW / Math.max(n - 1, 1)}
            height={innerH}
            fill="transparent"
            onClick={() => setSel(sel === i ? null : i)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>
      <ul className="chart-legend chart-legend--inline">
        {series.map((s) => (
          <li key={s.name}>
            <span className="legend-dot" style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
