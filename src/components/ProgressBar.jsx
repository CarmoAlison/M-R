import { useEffect, useState } from 'react'
import './ProgressBar.css'

/** Barra que preenche ao entrar. Cor: verde -> amarelo (80%) -> vermelho (100%). */
export default function ProgressBar({ ratio, label, tone, height = 10 }) {
  const [width, setWidth] = useState(0)
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100
  const auto = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])

  return (
    <div
      className={`progress progress--${tone || auto}`}
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((ratio || 0) * 100)}
    >
      <span className="progress-fill" style={{ width: `${width}%` }} />
    </div>
  )
}
