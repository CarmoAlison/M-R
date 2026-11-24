import { forwardRef } from 'react'
import { brl } from '../lib/format'
import './MoneyInput.css'

/**
 * Campo de valor com máscara R$ (digita-se como numa maquininha: 1234 -> R$ 12,34).
 * `value` em reais (número); `onChange(number)`.
 */
const MoneyInput = forwardRef(function MoneyInput({ value, onChange, label = 'Valor', tone, id, large = false, ...rest }, ref) {
  const cents = Math.round((Number(value) || 0) * 100)

  const handleChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
    onChange(Number(digits || 0) / 100)
  }

  return (
    <label className={`money-input ${large ? 'money-input--large' : ''} ${tone ? `money-input--${tone}` : ''}`} htmlFor={id}>
      <span className="money-input-label">{label}</span>
      <input
        ref={ref}
        id={id}
        className="money-input-field num"
        inputMode="numeric"
        autoComplete="off"
        value={brl(cents / 100)}
        onChange={handleChange}
        onFocus={(e) => requestAnimationFrame(() => e.target.setSelectionRange(e.target.value.length, e.target.value.length))}
        {...rest}
      />
    </label>
  )
})

export default MoneyInput
