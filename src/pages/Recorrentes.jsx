import { useMemo, useState } from 'react'
import { Pause, Pencil, Play, Square } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import MoneyInput from '../components/MoneyInput'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import { CategoryBubble } from '../components/CategoryIcon'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useLookups } from '../hooks/useLookups'
import { useFinanceActions } from '../hooks/useFinanceActions'
import { formatDate, todayISO } from '../lib/dates'
import { brl, sum } from '../lib/format'
import './Recorrentes.css'

export default function Recorrentes() {
  const { rules, transactions } = useData()
  const { catById, accountById, cardById, activeCategories } = useLookups()
  const actions = useFinanceActions()
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState('fixed')
  const [editing, setEditing] = useState(null)

  const today = todayISO()
  const ruleStatus = (r) => (r.end_date && r.end_date < today ? 'ended' : r.active ? 'active' : 'paused')
  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => ['active', 'paused', 'ended'].indexOf(ruleStatus(a)) - ['active', 'paused', 'ended'].indexOf(ruleStatus(b)) || a.day_of_month - b.day_of_month),
    [rules], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const monthlyFixed = sum(rules.filter((r) => ruleStatus(r) === 'active' && r.type === 'expense'), (r) => r.amount)

  const groups = useMemo(() => {
    const map = new Map()
    for (const t of transactions) {
      if (!t.installment_group_id) continue
      if (!map.has(t.installment_group_id)) map.set(t.installment_group_id, [])
      map.get(t.installment_group_id).push(t)
    }
    return [...map.entries()]
      .map(([id, items]) => {
        items.sort((a, b) => a.installment_number - b.installment_number)
        const next = items.find((t) => !t.paid && t.date >= today) || items.find((t) => !t.paid)
        const doneCount = items.filter((t) => t.paid || t.date < today).length
        return { id, items, first: items[0], total: sum(items, (t) => t.amount), next, doneCount, count: items[0].installment_total }
      })
      .sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1) || (a.next?.date || '').localeCompare(b.next?.date || ''))
  }, [transactions, today])

  const run = async (fn, msg) => {
    try {
      await fn()
      toast.success(msg)
    } catch (e) {
      toast.error(e.message)
    }
  }

  const end = async (r) => {
    const ok = await confirm({
      title: 'Encerrar lançamento fixo?',
      message: `“${r.description}” deixa de ser gerado e os lançamentos futuros pendentes serão removidos. O histórico é mantido.`,
      confirmLabel: 'Encerrar',
      tone: 'danger',
    })
    if (ok) run(() => actions.endRule(r), 'Fixo encerrado')
  }

  const endGroup = async (g) => {
    const ok = await confirm({
      title: 'Encerrar parcelamento?',
      message: 'As parcelas futuras ainda não pagas serão removidas (ex.: compra quitada antecipadamente).',
      confirmLabel: 'Encerrar parcelas',
      tone: 'danger',
    })
    if (ok) run(async () => {
      const n = await actions.endInstallments(g.id)
      if (!n) throw new Error('Não há parcelas futuras pendentes.')
    }, 'Parcelas futuras removidas')
  }

  const saveRule = async (e) => {
    e.preventDefault()
    const day = Number(editing.day_of_month)
    if (!(editing.amount > 0)) return toast.error('Informe um valor.')
    if (!(day >= 1 && day <= 31)) return toast.error('Dia do mês entre 1 e 31.')
    const original = rules.find((r) => r.id === editing.id)
    await run(
      () =>
        actions.editRule(original, {
          amount: editing.amount,
          description: editing.description.trim(),
          category_id: editing.category_id || null,
          day_of_month: day,
          end_date: editing.end_date || null,
        }),
      'Fixo atualizado (lançamentos futuros também)',
    )
    setEditing(null)
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Fixos e parcelamentos" back />

      <div className="segmented">
        <button type="button" aria-pressed={tab === 'fixed'} onClick={() => setTab('fixed')}>Fixos ({rules.length})</button>
        <button type="button" aria-pressed={tab === 'inst'} onClick={() => setTab('inst')}>Parcelamentos ({groups.length})</button>
      </div>

      {tab === 'fixed' ? (
        <>
          {rules.length > 0 && (
            <div className="card card--tight row-between">
              <span className="small muted strong">Gastos fixos ativos por mês</span>
              <span className="strong num t-expense">{brl(monthlyFixed)}</span>
            </div>
          )}
          {sortedRules.length ? (
            <div className="stack-sm stagger">
              {sortedRules.map((r) => {
                const st = ruleStatus(r)
                const cat = catById.get(r.category_id)
                return (
                  <article key={r.id} className={`card card--tight rule-card is-${st}`}>
                    <div className="row">
                      <CategoryBubble category={cat} size={40} />
                      <div className="grow">
                        <p className="strong ellipsis">{r.description || cat?.name || 'Fixo'}</p>
                        <p className="tiny muted ellipsis">
                          Todo dia {r.day_of_month} · {cardById.get(r.card_id)?.name || accountById.get(r.account_id)?.name || 'sem conta'}
                          {r.end_date && ` · até ${formatDate(r.end_date, { day: '2-digit', month: 'short', year: 'numeric' })}`}
                        </p>
                      </div>
                      <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 4 }}>
                        <span className={`num strong ${r.type === 'income' ? 't-income' : 't-expense'}`}>{brl(r.amount)}</span>
                        <span className={`badge ${st === 'active' ? 'badge--income' : st === 'paused' ? 'badge--warning' : ''}`}>
                          {st === 'active' ? 'Ativo' : st === 'paused' ? 'Pausado' : 'Encerrado'}
                        </span>
                      </div>
                    </div>
                    {st !== 'ended' && (
                      <div className="rule-actions">
                        <button type="button" className="btn btn-sm" onClick={() => setEditing({ ...r, amount: Number(r.amount), end_date: r.end_date || '' })}>
                          <Pencil size={16} /> Editar
                        </button>
                        {st === 'active' ? (
                          <button type="button" className="btn btn-sm" onClick={() => run(() => actions.pauseRule(r), 'Fixo pausado')}>
                            <Pause size={16} /> Pausar
                          </button>
                        ) : (
                          <button type="button" className="btn btn-sm" onClick={() => run(() => actions.resumeRule(r), 'Fixo retomado')}>
                            <Play size={16} /> Retomar
                          </button>
                        )}
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => end(r)}>
                          <Square size={14} /> Encerrar
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="card">
              <EmptyState title="Nenhum fixo" message="Ao lançar um ganho ou gasto, ative “Repetir todo mês” para ele aparecer aqui (aluguel, internet, salário…)." variant="list" />
            </div>
          )}
        </>
      ) : groups.length ? (
        <div className="stack-sm stagger">
          {groups.map((g) => {
            const cat = catById.get(g.first.category_id)
            return (
              <article key={g.id} className="card card--tight stack-sm">
                <div className="row">
                  <CategoryBubble category={cat} size={40} />
                  <div className="grow">
                    <p className="strong ellipsis">{g.first.description || cat?.name}</p>
                    <p className="tiny muted">
                      {g.count}× de {brl(g.items[g.items.length - 1].amount)} · {cardById.get(g.first.card_id)?.name || accountById.get(g.first.account_id)?.name || ''}
                    </p>
                  </div>
                  <span className="num strong">{brl(g.total)}</span>
                </div>
                <ProgressBar ratio={g.doneCount / g.count} tone="brand" label={`${g.doneCount} de ${g.count} parcelas`} height={8} />
                <div className="row-between tiny">
                  <span className="muted">{g.doneCount}/{g.count} parcelas</span>
                  {g.next ? (
                    <span>Próxima: <strong>{g.next.installment_number}/{g.count}</strong> em {formatDate(g.next.date)}</span>
                  ) : (
                    <span className="t-income strong">Quitado 🎉</span>
                  )}
                </div>
                {g.next && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => endGroup(g)}>
                    Encerrar parcelas futuras
                  </button>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState title="Nenhum parcelamento" message="Ao lançar um gasto, ative “Parcelado” e informe o número de parcelas." variant="list" />
        </div>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title="Editar fixo">
        {editing && (
          <form className="stack" onSubmit={saveRule}>
            <MoneyInput large tone={editing.type} value={editing.amount} onChange={(amount) => setEditing({ ...editing, amount })} />
            <label className="field">
              <span>Descrição</span>
              <input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} maxLength={80} />
            </label>
            <label className="field">
              <span>Categoria</span>
              <select className="select" value={editing.category_id || ''} onChange={(e) => setEditing({ ...editing, category_id: e.target.value })}>
                {activeCategories(editing.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <label className="field">
                <span>Dia do mês</span>
                <input className="input" type="number" inputMode="numeric" min={1} max={31} value={editing.day_of_month} onChange={(e) => setEditing({ ...editing, day_of_month: e.target.value })} />
              </label>
              <label className="field">
                <span>Termina em (opcional)</span>
                <input className="input" type="date" value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
              </label>
            </div>
            <p className="tiny muted">As mudanças valem para os lançamentos pendentes a partir de hoje.</p>
            <button className="btn btn-primary btn-block">Salvar</button>
          </form>
        )}
      </Sheet>
    </div>
  )
}
