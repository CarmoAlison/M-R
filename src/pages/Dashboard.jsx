import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CreditCard, Download, PiggyBank, Plus, TrendingDown, TrendingUp, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import MonthPicker from '../components/MonthPicker'
import AnimatedNumber from '../components/AnimatedNumber'
import DonutChart from '../components/DonutChart'
import ProgressBar from '../components/ProgressBar'
import TransactionItem from '../components/TransactionItem'
import EmptyState from '../components/EmptyState'
import MonthClosing from '../components/MonthClosing'
import Skeleton, { SkeletonList } from '../components/Skeleton'
import CategoryIcon, { CategoryBubble } from '../components/CategoryIcon'
import { InsightCarousel } from '../components/InsightCard'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useHousehold } from '../context/HouseholdContext'
import { useInstall } from '../context/InstallContext'
import { useQuickAdd } from '../context/QuickAddContext'
import { useMonth } from '../hooks/useMonth'
import { useTxEditor } from '../hooks/useTxEditor'
import { addDays, addMonths, currentMonth, diffDays, formatDate, greeting, monthLabel, todayISO } from '../lib/dates'
import { brl, firstName, numberToCents } from '../lib/format'
import { budgetProgress, byCategory, cardInvoices, cardUsed, percentChange, txInMonth } from '../lib/finance'
import { buildInsights } from '../lib/insights'
import './Dashboard.css'

const CLOSING_KEY = (hid) => `cf-closing-seen-${hid}`
const dueText = (d) => (d < 0 ? `venceu há ${-d}d` : d === 0 ? 'vence hoje' : `em ${d} ${d === 1 ? 'dia' : 'dias'}`)

export default function Dashboard() {
  const { profile } = useAuth()
  const { householdId } = useHousehold()
  const data = useData()
  const { month, monthTx, totals: t, prevTotals } = useMonth()
  const { installed, oneTap, install } = useInstall()
  const [installDismissed, setInstallDismissed] = useState(() => localStorage.getItem('cf-install-dismissed') === '1')
  const quickAdd = useQuickAdd()
  const editor = useTxEditor()
  const { transactions, categories, budgets, cards, goals, goalEntries, loading } = data
  const [closing, setClosing] = useState(null)

  const donut = useMemo(() => byCategory(monthTx, categories), [monthTx, categories])
  const atRisk = useMemo(() => budgetProgress(budgets, categories, monthTx).filter((b) => b.status !== 'ok'), [budgets, categories, monthTx])
  const insights = useMemo(() => buildInsights({ transactions, categories, budgets, cards, month }), [transactions, categories, budgets, cards, month])

  // resumo do mês anterior: aparece uma vez nos primeiros dias do mês
  useEffect(() => {
    if (loading || !householdId) return
    const prev = addMonths(currentMonth(), -1)
    const seen = localStorage.getItem(CLOSING_KEY(householdId))
    if (seen === prev || new Date().getDate() > 10) return
    if (txInMonth(transactions, prev).length >= 3) setClosing(prev)
  }, [loading, householdId, transactions])

  const closeClosing = () => {
    if (closing === addMonths(currentMonth(), -1)) localStorage.setItem(CLOSING_KEY(householdId), closing)
    setClosing(null)
  }

  const upcoming = useMemo(() => {
    const limit = addDays(todayISO(), 10)
    return transactions
      .filter((x) => !x.paid && !x.card_id && x.type === 'expense' && x.date <= limit)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5)
  }, [transactions])

  const invoices = useMemo(
    () =>
      cards
        .map((card) => {
          const list = cardInvoices(card, transactions)
          const open = list.find((i) => i.status !== 'paid' && i.status !== 'future') || list.find((i) => i.status === 'future')
          return open ? { card, invoice: open, used: cardUsed(card, transactions) } : null
        })
        .filter(Boolean),
    [cards, transactions],
  )

  const goalList = useMemo(() => {
    const saved = new Map()
    for (const e of goalEntries) saved.set(e.goal_id, (saved.get(e.goal_id) || 0) + numberToCents(e.amount))
    return goals
      .filter((g) => !g.archived)
      .map((g) => ({ ...g, saved: (saved.get(g.id) || 0) / 100 }))
      .slice(0, 3)
  }, [goals, goalEntries])

  const recent = monthTx.slice(0, 6)
  const expChange = percentChange(t.expense, prevTotals.expense)
  const spentRatio = t.income > 0 ? t.expense / t.income : 0

  return (
    <div className="page dashboard">
      <PageHeader subtitle={`${greeting()} 👋`} title={profile?.name ? firstName(profile.name) : 'Resumo da casa'} />

      <div className="dash-grid">
        <div className="dash-main stack">
          <div className="dash-month">
            <MonthPicker />
          </div>

          <section className="card balance-card slide-up" aria-label="Saldo do mês">
            <div className="row-between">
              <p className="tiny muted strong balance-label">Saldo de {monthLabel(month, { withYear: false }).toLowerCase()}</p>
              {month === addMonths(currentMonth(), -1) && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setClosing(month)}>Ver fechamento</button>
              )}
            </div>
            {loading ? (
              <Skeleton height={48} width="55%" />
            ) : (
              <AnimatedNumber value={t.balance} className={`display-num balance-value ${t.balance < 0 ? 't-expense' : ''}`} />
            )}

            <div className="balance-split">
              <Link to="/lancamentos?tipo=income" className="balance-stat">
                <span className="balance-stat-icon is-income"><TrendingUp size={18} /></span>
                <span>
                  <span className="tiny muted block">Ganhos</span>
                  <AnimatedNumber value={t.income} className="strong" />
                </span>
              </Link>
              <Link to="/lancamentos" className="balance-stat">
                <span className="balance-stat-icon is-expense"><TrendingDown size={18} /></span>
                <span>
                  <span className="tiny muted block">Gastos</span>
                  <AnimatedNumber value={t.expense} className="strong" />
                </span>
              </Link>
            </div>

            {t.income > 0 && (
              <div className="stack-sm balance-progress">
                <ProgressBar ratio={spentRatio} label={`Gastaram ${Math.round(spentRatio * 100)}% do que ganharam`} height={8} />
                <p className="tiny muted">
                  Gastaram {Math.round(spentRatio * 100)}% do que ganharam
                  {expChange != null && ` · ${expChange >= 0 ? `${Math.round(expChange)}% acima` : `${Math.round(-expChange)}% abaixo`} do mês anterior`}
                  {t.pending > 0 && ` · ${brl(t.pending)} pendente`}
                </p>
              </div>
            )}
          </section>

          {!installed && !installDismissed && (
            <div className="banner banner--info install-banner no-print">
              <button type="button" className="install-banner-main" onClick={install}>
                <Download size={18} />
                <span className="grow">
                  <strong className="block">Instale o app no seu {oneTap ? 'aparelho' : 'celular'}</strong>
                  <span className="tiny">Abre mais rápido, em tela cheia e com notificações.</span>
                </span>
                <span className="install-banner-cta">Instalar</span>
              </button>
              <button
                type="button"
                className="icon-btn install-banner-close"
                aria-label="Dispensar"
                onClick={() => {
                  localStorage.setItem('cf-install-dismissed', '1')
                  setInstallDismissed(true)
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {insights.length > 0 && (
            <section aria-label="Insights">
              <InsightCarousel insights={insights} />
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="card">
              <div className="row-between">
                <h2 className="card-title">Próximos vencimentos</h2>
                <CalendarClock size={18} className="muted" aria-hidden="true" />
              </div>
              <ul className="list due-list">
                {upcoming.map((x) => {
                  const d = diffDays(todayISO(), x.date)
                  return (
                    <li key={x.id} className="list-item">
                      <span className={`due-date ${d < 0 ? 'is-late' : d <= 3 ? 'is-soon' : ''}`}>
                        <strong>{x.date.slice(8, 10)}</strong>
                        <span>{formatDate(x.date, { month: 'short' })}</span>
                      </span>
                      <span className="grow ellipsis strong">{x.description || 'Conta'}</span>
                      <span className="stack-sm" style={{ alignItems: 'flex-end', gap: 2 }}>
                        <span className="num strong">{brl(x.amount)}</span>
                        <span className={`tiny ${d < 0 ? 't-expense' : 'muted'}`}>{dueText(d)}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="card">
            <div className="row-between">
              <h2 className="card-title">Gastos por categoria</h2>
              <Link to="/relatorio" className="tiny strong">Ver relatório</Link>
            </div>
            {loading ? (
              <div className="row" style={{ marginTop: 16 }}><Skeleton width={150} height={150} radius={999} /></div>
            ) : donut.length ? (
              <div style={{ marginTop: 14 }}>
                <DonutChart data={donut} centerLabel="Total" centerValue={<span className="num">{brl(t.expense)}</span>} />
              </div>
            ) : (
              <EmptyState title="Nenhum gasto ainda" message="Os gastos do mês aparecem aqui divididos por categoria." />
            )}
          </section>

          <section className="card">
            <div className="row-between">
              <h2 className="card-title">Últimos lançamentos</h2>
              <Link to="/lancamentos?tipo=all" className="tiny strong">Ver todos</Link>
            </div>
            {loading ? (
              <div style={{ marginTop: 12 }}><SkeletonList rows={3} /></div>
            ) : recent.length ? (
              <div className="list stagger" style={{ marginTop: 6 }}>
                {recent.map((x) => (
                  <TransactionItem key={x.id} tx={x} onEdit={editor.editTx} onDelete={editor.deleteTx} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Mês tranquilo por aqui"
                message="Lance o primeiro ganho ou gasto do mês."
                variant="list"
                action={<button type="button" className="btn btn-primary" onClick={() => quickAdd.open('expense')}><Plus size={18} /> Novo lançamento</button>}
              />
            )}
          </section>
        </div>

        <aside className="dash-side stack">
          {atRisk.length > 0 && (
            <section className="card stack-sm">
              <div className="row-between">
                <h2 className="card-title">Metas em atenção</h2>
                <Link to="/metas" className="tiny strong">Metas</Link>
              </div>
              {atRisk.map((b) => (
                <Link key={b.id} to="/metas" className="budget-mini">
                  <CategoryBubble category={b.category} size={34} />
                  <div className="grow stack-sm" style={{ gap: 4 }}>
                    <div className="row-between">
                      <span className="strong small">{b.category.name}</span>
                      <span className={`small strong ${b.status === 'over' ? 't-expense' : 't-warning'}`}>{Math.round(b.ratio * 100)}%</span>
                    </div>
                    <ProgressBar ratio={b.ratio} label={`Meta de ${b.category.name}`} height={7} />
                  </div>
                </Link>
              ))}
            </section>
          )}

          {invoices.length > 0 && (
            <section className="card stack-sm">
              <div className="row-between">
                <h2 className="card-title">Faturas</h2>
                <Link to="/contas" className="tiny strong">Cartões</Link>
              </div>
              {invoices.map(({ card, invoice, used }) => (
                <Link key={card.id} to="/contas" className="invoice-mini" style={{ '--card-color': card.color }}>
                  <span className="invoice-mini-icon"><CreditCard size={18} /></span>
                  <span className="grow">
                    <span className="strong block ellipsis">{card.name}</span>
                    <span className="tiny muted">
                      {invoice.status === 'overdue' ? 'Vencida' : invoice.status === 'closed' ? 'Fechada' : 'Aberta'} · vence {formatDate(invoice.due)}
                    </span>
                    {card.credit_limit > 0 && <ProgressBar ratio={used / card.credit_limit} label="Limite usado" height={5} />}
                  </span>
                  <span className="num strong">{brl(invoice.open)}</span>
                </Link>
              ))}
            </section>
          )}

          <section className="card stack-sm">
            <div className="row-between">
              <h2 className="card-title">Objetivos</h2>
              <Link to="/objetivos" className="tiny strong">{goalList.length ? 'Ver todos' : 'Criar'}</Link>
            </div>
            {goalList.length ? (
              goalList.map((g) => (
                <Link key={g.id} to="/objetivos" className="goal-mini">
                  <span className="icon-bubble" style={{ width: 36, height: 36, background: `${g.color}1c`, color: g.color }}>
                    <CategoryIcon name={g.icon} size={18} />
                  </span>
                  <span className="grow stack-sm" style={{ gap: 4 }}>
                    <span className="row-between small">
                      <span className="strong ellipsis">{g.name}</span>
                      <span className="muted num">{Math.round(Math.min(1, g.saved / g.target_amount) * 100)}%</span>
                    </span>
                    <ProgressBar ratio={g.saved / g.target_amount} tone="brand" label={`${g.name}: ${brl(g.saved)} de ${brl(g.target_amount)}`} height={7} />
                    <span className="tiny muted">{brl(g.saved)} de {brl(g.target_amount)}</span>
                  </span>
                </Link>
              ))
            ) : (
              <Link to="/objetivos" className="goal-empty">
                <PiggyBank size={22} />
                <span className="small">Crie uma caixinha para a reserva de emergência, a viagem…</span>
              </Link>
            )}
          </section>
        </aside>
      </div>

      {editor.sheet}
      {closing && <MonthClosing month={closing} open={Boolean(closing)} onClose={closeClosing} />}
    </div>
  )
}
