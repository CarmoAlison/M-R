import { ChevronLeft, ChevronRight } from 'lucide-react'
import { currentMonth, monthLabel } from '../lib/dates'
import { useMonthContext } from '../context/MonthContext'
import './MonthPicker.css'

export default function MonthPicker({ compact = false }) {
  const { month, prev, next, reset } = useMonthContext()
  const isCurrent = month === currentMonth()
  return (
    <div className={`month-picker ${compact ? 'month-picker--compact' : ''}`}>
      <button type="button" className="icon-btn" onClick={prev} aria-label="Mês anterior">
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        className="month-picker-label"
        onClick={reset}
        aria-live="polite"
        title={isCurrent ? undefined : 'Voltar para o mês atual'}
      >
        {monthLabel(month)}
        {!isCurrent && <span className="month-picker-hint">voltar para hoje</span>}
      </button>
      <button type="button" className="icon-btn" onClick={next} aria-label="Próximo mês">
        <ChevronRight size={22} />
      </button>
    </div>
  )
}
