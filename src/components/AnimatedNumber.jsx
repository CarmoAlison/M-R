import { useEffect, useRef, useState } from 'react'
import { brl } from '../lib/format'

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Contagem animada de valores (easeOutCubic, ~700ms). */
export default function AnimatedNumber({ value, format = brl, duration = 700, className }) {
  const [display, setDisplay] = useState(reduced() ? value : 0)
  const fromRef = useRef(reduced() ? value : 0)

  useEffect(() => {
    if (reduced()) {
      setDisplay(value)
      fromRef.current = value
      return
    }
    const from = fromRef.current
    const start = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - p) ** 3
      const v = from + (value - from) * eased
      setDisplay(v)
      fromRef.current = v
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <span className={`num ${className || ''}`} aria-label={format(value)}>
      <span aria-hidden="true">{format(display)}</span>
    </span>
  )
}
