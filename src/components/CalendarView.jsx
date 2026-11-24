import { useMemo } from 'react'
import { daysInMonth, todayISO } from '../lib/dates'
import { brlShort, numberToCents } from '../lib/format'
import './CalendarView.css'

/** 2400 -> "2,4k" · 389.9 -> "390" (cabe numa célula de 45px) */
const compact = (v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : Math.round(v).toString())

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const WEEK_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** Calendário do mês: gastos/ganhos por dia e marcação de contas pendentes. */
export default function CalendarView({ month, transactions, selected, onSelect }) {
  const days = useMemo(() => {
    const map = new Map()
    for (const t of transactions) {
      const d = t.date
      if (!d.startsWith(month)) continue
      const cur = map.get(d) || { expense: 0, income: 0, pending: 0 }
      if (t.type === 'expense') cur.expense += numberToCents(t.amount)
      else cur.income += numberToCents(t.amount)
      if (!t.paid && !t.card_id) cur.pending++
      map.set(d, cur)
    }
    return map
  }, [transactions, month])

  const [y, m] = month.split('-').map(Number)
  const firstWeekday = new Date(y, m - 1, 1).getDay()
  const total = daysInMonth(month)
  const today = todayISO()
  const maxExpense = Math.max(1, ...[...days.values()].map((d) => d.expense))

  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]

  return (
    <div className="calendar">
      <div className="calendar-week" aria-hidden="true">
        {WEEK.map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="calendar-grid" role="grid" aria-label="Calendário do mês">
        {cells.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} className="calendar-empty" />
          const info = days.get(iso)
          const day = Number(iso.slice(8))
          const intensity = info ? info.expense / maxExpense : 0
          const label = [
            `${day}, ${WEEK_FULL[new Date(y, m - 1, day).getDay()]}`,
            info?.expense ? `gastos ${brlShort(info.expense / 100)}` : null,
            info?.income ? `ganhos ${brlShort(info.income / 100)}` : null,
            info?.pending ? `${info.pending} pendente(s)` : null,
          ]
            .filter(Boolean)
            .join(', ')
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              className={`calendar-day ${iso === selected ? 'is-selected' : ''} ${iso === today ? 'is-today' : ''}`}
              onClick={() => onSelect(iso === selected ? null : iso)}
              aria-label={label}
              aria-selected={iso === selected}
              style={{ '--heat': intensity }}
            >
              <span className="calendar-num">{day}</span>
              {info?.expense > 0 && <span className="calendar-amount">{compact(info.expense / 100)}</span>}
              <span className="calendar-dots">
                {info?.income > 0 && <i className="dot dot--income" />}
                {info?.pending > 0 && <i className="dot dot--pending" />}
              </span>
            </button>
          )
        })}
      </div>
      <div className="calendar-legend tiny muted">
        <span><i className="dot dot--heat" /> intensidade dos gastos</span>
        <span><i className="dot dot--income" /> ganho</span>
        <span><i className="dot dot--pending" /> conta pendente</span>
      </div>
    </div>
  )
}
