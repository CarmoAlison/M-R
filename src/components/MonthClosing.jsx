import { useMemo } from 'react'
import { PartyPopper, TrendingDown, TrendingUp } from 'lucide-react'
import Sheet from './Sheet'
import { CategoryBubble } from './CategoryIcon'
import { useData } from '../context/DataContext'
import { addMonths, monthLabel, monthName } from '../lib/dates'
import { brl, signedPct } from '../lib/format'
import { budgetProgress, byCategory, isNormal, percentChange, totals, txInMonth } from '../lib/finance'
import './MonthClosing.css'

/** Resumo de fechamento de um mês (quanto sobrou, onde mais gastou, metas). */
export default function MonthClosing({ month, open, onClose }) {
  const { transactions, categories, budgets } = useData()

  const s = useMemo(() => {
    const cur = txInMonth(transactions, month)
    const prev = txInMonth(transactions, addMonths(month, -1))
    const t = totals(cur)
    const p = totals(prev)
    const top = byCategory(cur, categories).slice(0, 3)
    const prevCats = new Map(byCategory(prev, categories).map((c) => [c.id, c.value]))
    const grew = byCategory(cur, categories)
      .map((c) => ({ ...c, delta: c.value - (prevCats.get(c.id) || 0) }))
      .sort((a, b) => b.delta - a.delta)[0]
    const biggest = cur.filter((x) => x.type === 'expense' && isNormal(x)).sort((a, b) => b.amount - a.amount)[0]
    const goals = budgetProgress(budgets, categories, cur)
    return {
      t,
      p,
      top,
      grew: grew && grew.delta > 0 && prev.length ? grew : null,
      biggest,
      expChange: percentChange(t.expense, p.expense),
      saveRate: t.income > 0 ? Math.round((t.balance / t.income) * 100) : null,
      goalsOk: goals.filter((g) => g.status !== 'over').length,
      goalsTotal: goals.length,
    }
  }, [transactions, categories, budgets, month])

  const green = s.t.balance >= 0

  return (
    <Sheet open={open} onClose={onClose} title={`Fechamento de ${monthLabel(month)}`}>
      <div className="closing stack">
        <div className={`closing-hero ${green ? 'is-green' : 'is-red'}`}>
          {green ? <PartyPopper size={28} /> : <TrendingDown size={28} />}
          <p className="small strong">{green ? 'O mês fechou no verde!' : 'O mês fechou no vermelho'}</p>
          <p className="display-num closing-value">{brl(s.t.balance)}</p>
          {s.saveRate != null && green && <p className="tiny">Vocês guardaram {s.saveRate}% do que ganharam.</p>}
        </div>

        <div className="grid-2">
          <div className="card card--flat card--tight">
            <span className="tiny muted strong">Ganhos</span>
            <strong className="num t-income">{brl(s.t.income)}</strong>
          </div>
          <div className="card card--flat card--tight">
            <span className="tiny muted strong">Gastos</span>
            <strong className="num t-expense">{brl(s.t.expense)}</strong>
            {s.expChange != null && (
              <span className={`tiny ${s.expChange <= 0 ? 't-income' : 't-expense'}`}>
                {signedPct(s.expChange)} vs. {monthName(addMonths(month, -1))}
              </span>
            )}
          </div>
        </div>

        {s.top.length > 0 && (
          <div className="stack-sm">
            <p className="section-title">Onde mais gastaram</p>
            {s.top.map((c, i) => (
              <div key={c.id} className="row">
                <span className="closing-pos">{i + 1}º</span>
                <CategoryBubble category={c} size={34} />
                <span className="grow strong">{c.label}</span>
                <span className="num strong">{brl(c.value)}</span>
              </div>
            ))}
          </div>
        )}

        <ul className="closing-facts">
          {s.biggest && <li>Maior gasto: <strong>{s.biggest.description || 'sem descrição'}</strong> ({brl(s.biggest.amount)})</li>}
          {s.grew && (
            <li>
              <TrendingUp size={14} /> {s.grew.label} cresceu {brl(s.grew.delta)} em relação ao mês anterior
            </li>
          )}
          {s.goalsTotal > 0 && <li>Metas cumpridas: <strong>{s.goalsOk} de {s.goalsTotal}</strong></li>}
        </ul>

        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>Entendi</button>
      </div>
    </Sheet>
  )
}
