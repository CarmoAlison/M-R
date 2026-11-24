import { useMemo, useState } from 'react'
import { Target } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import MonthPicker from '../components/MonthPicker'
import Sheet from '../components/Sheet'
import MoneyInput from '../components/MoneyInput'
import ProgressBar from '../components/ProgressBar'
import { CategoryBubble } from '../components/CategoryIcon'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useMonth } from '../hooks/useMonth'
import { useFinanceActions } from '../hooks/useFinanceActions'
import { brl, sum } from '../lib/format'
import { budgetProgress, byCategory } from '../lib/finance'
import './Metas.css'

export default function Metas() {
  const { categories, budgets } = useData()
  const { monthTx } = useMonth()
  const { setBudget } = useFinanceActions()
  const toast = useToast()
  const [editing, setEditing] = useState(null) // { category, limit }

  const progress = useMemo(() => budgetProgress(budgets, categories, monthTx), [budgets, categories, monthTx])
  const spentByCat = useMemo(() => new Map(byCategory(monthTx, categories).map((c) => [c.id, c.value])), [monthTx, categories])
  const withoutBudget = categories.filter((c) => c.type === 'expense' && !c.archived && !budgets.some((b) => b.category_id === c.id))
  const totalLimit = sum(progress, (b) => b.monthly_limit)
  const totalSpent = sum(progress, (b) => b.spent)

  const save = async (e) => {
    e?.preventDefault()
    try {
      await setBudget(editing.category.id, editing.limit)
      toast.success(editing.limit ? 'Meta salva' : 'Meta removida')
      setEditing(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const remove = async () => {
    try {
      await setBudget(editing.category.id, 0)
      toast.success('Meta removida')
      setEditing(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const statusText = (b) =>
    b.status === 'over' ? `Passou ${brl(b.spent - b.monthly_limit)}` : b.status === 'warn' ? 'Quase no limite' : `Restam ${brl(b.monthly_limit - b.spent)}`

  return (
    <div className="page page--narrow">
      <PageHeader title="Metas por categoria" back />
      <MonthPicker />

      {progress.length > 0 && (
        <section className="card stack-sm">
          <div className="row-between">
            <span className="tiny muted strong">Total das metas</span>
            <span className="small strong num">{brl(totalSpent)} / {brl(totalLimit)}</span>
          </div>
          <ProgressBar ratio={totalLimit ? totalSpent / totalLimit : 0} label="Total das metas" height={12} />
        </section>
      )}

      <section className="stack-sm stagger">
        {progress.map((b) => (
          <button key={b.id} type="button" className={`card card--tight budget-row is-${b.status}`} onClick={() => setEditing({ category: b.category, limit: Number(b.monthly_limit) })}>
            <CategoryBubble category={b.category} size={40} />
            <div className="grow stack-sm" style={{ gap: 6 }}>
              <div className="row-between">
                <span className="strong">{b.category.name}</span>
                <span className={`badge ${b.status === 'over' ? 'badge--expense' : b.status === 'warn' ? 'badge--warning' : 'badge--income'}`}>{Math.round(b.ratio * 100)}%</span>
              </div>
              <ProgressBar ratio={b.ratio} label={`Meta de ${b.category.name}`} />
              <div className="row-between tiny">
                <span className="num">{brl(b.spent)} de {brl(b.monthly_limit)}</span>
                <span className={b.status === 'over' ? 't-expense strong' : b.status === 'warn' ? 't-warning strong' : 'muted'}>{statusText(b)}</span>
              </div>
            </div>
          </button>
        ))}
        {!progress.length && (
          <div className="card budget-empty">
            <Target size={30} className="muted" />
            <p className="strong">Nenhuma meta ainda</p>
            <p className="muted small">Defina um limite mensal para as categorias abaixo. Avisamos quando chegar em 80% e 100%.</p>
          </div>
        )}
      </section>

      {withoutBudget.length > 0 && (
        <>
          <h2 className="section-title">Adicionar meta</h2>
          <div className="card list">
            {withoutBudget.map((c) => (
              <button key={c.id} type="button" className="link-row" onClick={() => setEditing({ category: c, limit: 0 })}>
                <CategoryBubble category={c} size={36} />
                <span className="grow">{c.name}</span>
                <span className="tiny muted">{spentByCat.get(c.id) ? `${brl(spentByCat.get(c.id))} no mês` : 'Definir'}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing ? `Meta: ${editing.category.name}` : ''}>
        {editing && (
          <form className="stack" onSubmit={save}>
            <MoneyInput large label="Limite mensal" value={editing.limit} onChange={(limit) => setEditing({ ...editing, limit })} data-autofocus />
            <p className="tiny muted">Gasto neste mês: {brl(spentByCat.get(editing.category.id) || 0)}</p>
            <button className="btn btn-primary btn-block">Salvar meta</button>
            {budgets.some((b) => b.category_id === editing.category.id) && (
              <button type="button" className="btn btn-danger btn-block" onClick={remove}>
                Remover meta
              </button>
            )}
          </form>
        )}
      </Sheet>
    </div>
  )
}
