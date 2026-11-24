import { useEffect } from 'react'
import { Delete } from 'lucide-react'
import './AmountPad.css'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'back']

/**
 * Teclado numérico estilo calculadora. Trabalha em centavos (inteiro):
 * digitar 1, 2, 5, 0 => R$ 12,50.
 * Também aceita o teclado físico quando nenhum campo de texto está focado.
 */
export default function AmountPad({ cents, onChange, max = 99999999999 }) {
  const press = (k) => {
    navigator.vibrate?.(6)
    if (k === 'back') return onChange(Math.floor(cents / 10))
    const next = Number(String(cents) + k)
    if (next <= max) onChange(next)
  }

  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (/^\d$/.test(e.key)) {
        e.preventDefault()
        press(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        press('back')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="amount-pad" role="group" aria-label="Teclado numérico">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          className={`amount-key ${k === 'back' ? 'amount-key--soft' : ''}`}
          onClick={() => press(k)}
          aria-label={k === 'back' ? 'Apagar' : k}
          disabled={k === 'back' && !cents}
        >
          {k === 'back' ? <Delete size={22} /> : k}
        </button>
      ))}
    </div>
  )
}
