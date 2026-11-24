import { useEffect, useState } from 'react'
import { brl, brlShort } from '../lib/format'
import './Charts.css'

/** Barras verticais agrupadas. series: [{ name, color, values: number[] }] */
export default function BarChart({ labels, series, height = 190 }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const W = 340
  const padL = 44
  const padB = 26
  const padT = 10
  const innerW = W - padL - 6
  const innerH = height - padB - padT
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const groupW = innerW / Math.max(labels.length, 1)
  const barW = Math.min(18, (groupW * 0.7) / series.length)
  const ticks = [0, 0.5, 1]

  const desc = labels
    .map((l, i) => `${l}: ${series.map((s) => `${s.name} ${brl(s.values[i])}`).join(', ')}`)
    .join('; ')

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${height}`} width="100%" role="img" aria-label={desc}>
      {ticks.map((t) => {
        const y = padT + innerH * (1 - t)
        return (
          <g key={t}>
            <line x1={padL} x2={W - 4} y1={y} y2={y} className="chart-grid" />
            <text x={padL - 6} y={y + 4} className="chart-axis" textAnchor="end">
              {brlShort(max * t).replace(',00', '')}
            </text>
          </g>
        )
      })}
      {labels.map((label, i) => {
        const gx = padL + groupW * i + (groupW - barW * series.length - 2 * (series.length - 1)) / 2
        return (
          <g key={label + i}>
            {series.map((s, j) => {
              const h = (s.values[i] / max) * innerH
              return (
                <rect
                  key={s.name}
                  x={gx + j * (barW + 2)}
                  y={padT + innerH - h}
                  width={barW}
                  height={Math.max(h, 0)}
                  rx={Math.min(6, barW / 2)}
                  fill={s.color}
                  className="chart-bar"
                  style={{ transform: ready ? 'scaleY(1)' : 'scaleY(0)', transitionDelay: `${i * 40}ms` }}
                >
                  <title>{`${label} · ${s.name}: ${brl(s.values[i])}`}</title>
                </rect>
              )
            })}
            <text x={padL + groupW * i + groupW / 2} y={height - 8} className="chart-axis" textAnchor="middle">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
