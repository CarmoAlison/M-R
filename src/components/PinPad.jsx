import { useEffect, useState } from 'react'
import { Delete } from 'lucide-react'
import './PinPad.css'

/**
 * Teclado numérico próprio. Chama onComplete(pin) ao atingir `length` dígitos.
 * `error` (incrementar a cada erro) dispara a animação de tremor.
 */
export default function PinPad({ length = 4, onComplete, error = 0, disabled = false, label = 'Digite seu PIN', allowVariable = false }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!error) return
    setShake(true)
    setPin('')
    navigator.vibrate?.([40, 50, 40])
    const t = setTimeout(() => setShake(false), 450)
    return () => clearTimeout(t)
  }, [error])

  const press = (d) => {
    if (disabled) return
    const next = (pin + d).slice(0, allowVariable ? 6 : length)
    setPin(next)
    navigator.vibrate?.(8)
    if (!allowVariable && next.length === length) {
      setTimeout(() => {
        onComplete(next)
        setPin('')
      }, 120)
    }
  }
  const back = () => setPin((p) => p.slice(0, -1))

  // teclado físico
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
      else if (e.key === 'Enter' && allowVariable && pin.length >= 4) {
        onComplete(pin)
        setPin('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const dots = allowVariable ? Math.max(4, pin.length) : length

  return (
    <div className="pinpad">
      <p className="pinpad-label" id="pin-label">{label}</p>
      <div className={`pin-dots ${shake ? 'shake' : ''}`} aria-live="polite" aria-label={`${pin.length} de ${allowVariable ? '4 a 6' : length} dígitos`}>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} className={`pin-dot ${i < pin.length ? 'is-filled' : ''} ${shake ? 'is-error' : ''}`} />
        ))}
      </div>
      <div className="pin-keys" role="group" aria-labelledby="pin-label">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className="pin-key" onClick={() => press(d)} disabled={disabled}>
            {d}
          </button>
        ))}
        {allowVariable ? (
          <button
            type="button"
            className="pin-key pin-key--text"
            onClick={() => {
              onComplete(pin)
              setPin('')
            }}
            disabled={disabled || pin.length < 4}
          >
            OK
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="pin-key" onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button type="button" className="pin-key pin-key--ghost" onClick={back} aria-label="Apagar" disabled={disabled || !pin}>
          <Delete size={24} />
        </button>
      </div>
    </div>
  )
}
