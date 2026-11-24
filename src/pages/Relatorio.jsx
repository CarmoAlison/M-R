import { useMemo, useState } from 'react'
import { CalendarCheck, Download, Printer } from 'lucide-react'
import MonthClosing from '../components/MonthClosing'
import PageHeader from '../components/PageHeader'
import LineChart from '../components/LineChart'
import BarChart from '../components/BarChart'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import Avatar from '../components/Avatar'
import { CategoryBubble } from '../components/CategoryIcon'
import { useData } from '../context/DataContext'
import { useHousehold } from '../context/HouseholdContext'
import { useToast } from '../context/ToastContext'
import { useLookups } from '../hooks/useLookups'
import { addMonths, currentMonth, formatDate, monthLabel, monthRange } from '../lib/dates'
import { brl, numberToCents } from '../lib/format'
import { byCategory, isNormal, totals } from '../lib/finance'
import { downloadFile, toCSV } from '../lib/csv'
import './Relatorio.css'

const PERIODS = [
  ['1', 'Mês'],
  ['3', '3 meses'],
  ['6', '6 meses'],
  ['12', '12 meses'],
  ['custom', 'Personalizado'],
]

const plainFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const plain = (n) => plainFmt.format(n)

function groupSum(list, keyFn) {
  const map = new Map()
  for (const t of list) {
    const k = keyFn(t)
    map.set(k, (map.get(k) || 0) + numberToCents(t.amount))
  }
  return [...map.entries()].map(([k, c]) => [k, c / 100]).sort((a, b) => b[1] - a[1])
}

export default function Relatorio() {
  const { transactions, categories, cards } = useData()
  const { members, household } = useHousehold()
  const { catById, accountById, cardById } = useLookups()
  const toast = useToast()
  const [period, setPeriod] = useState('6')
  const [from, setFrom] = useState(addMonths(currentMonth(), -2))
  const [to, setTo] = useState(currentMonth())
  const [closing, setClosing] = useState(null)
  const lastClosed = addMonths(currentMonth(), -1)

  const months = useMemo(() => {
    if (period === 'custom') return from <= to ? monthRange(from, to) : monthRange(to, from)
    const n = Number(period)
    return monthRange(addMonths(currentMonth(), -(n - 1)), currentMonth())
  }, [period, from, to])

  const periodTx = useMemo(() => {
    const set = new Set(months)
    return transactions.filter((t) => set.has(t.date.slice(0, 7)) && isNormal(t))
  }, [transactions, months])

  const perMonth = useMemo(() => months.map((m) => ({ m, ...totals(periodTx.filter((t) => t.date.startsWith(m))) })), [months, periodTx])
  const sum = totals(periodTx)
  const ranking = useMemo(() => byCategory(periodTx, categories), [periodTx, categories])
  const expenses = periodTx.filter((t) => t.type === 'expense')
  const byPerson = groupSum(expenses, (t) => t.user_id || 'none')
  const byCard = groupSum(expenses.filter((t) => t.card_id), (t) => t.card_id)
  const labels = months.map((m) => monthLabel(m, { short: true, withYear: months.length > 12 || period === 'custom' }))
  const memberName = (id) => members.find((m) => m.user_id === id)?.profiles?.name || 'Ex-membro'
  const periodLabel = months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0], { short: true })} – ${monthLabel(months[months.length - 1], { short: true })}`

  const exportCSV = () => {
    const rows = [...periodTx].sort((a, b) => a.date.localeCompare(b.date))
    const csv = toCSV(rows, [
      { label: 'Data', value: (t) => formatDate(t.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) },
      { label: 'Tipo', value: (t) => (t.type === 'income' ? 'Ganho' : 'Gasto') },
      { label: 'Descrição', value: (t) => t.description },
      { label: 'Categoria', value: (t) => catById.get(t.category_id)?.name || '' },
      { label: 'Conta/Cartão', value: (t) => cardById.get(t.card_id)?.name || accountById.get(t.account_id)?.name || '' },
      { label: 'Valor', value: (t) => Number(t.amount).toFixed(2).replace('.', ',') },
      { label: 'Situação', value: (t) => (t.paid ? 'Pago' : 'Pendente') },
      { label: 'Parcela', value: (t) => (t.installment_total ? `${t.installment_number}/${t.installment_total}` : '') },
      { label: 'Lançado por', value: (t) => memberName(t.user_id) },
    ])
    downloadFile(`relatorio-${months[0]}-a-${months[months.length - 1]}.csv`, csv)
    toast.success('CSV exportado')
  }

  return (
    <div className="page page--narrow relatorio">
      <PageHeader
        title="Relatório"
        subtitle={household?.name}
        actions={
          <button type="button" className="btn btn-sm no-print" onClick={() => setClosing(lastClosed)}>
            <CalendarCheck size={16} /> Fechamento de {monthLabel(lastClosed, { short: true, withYear: false })}
          </button>
        }
      />

      <div className="chips chips--wrap no-print" role="group" aria-label="Período">
        {PERIODS.map(([v, l]) => (
          <button key={v} type="button" className="chip" aria-pressed={period === v} onClick={() => setPeriod(v)}>
            {l}
          </button>
        ))}
      </div>
      {period === 'custom' && (
        <div className="grid-2 no-print fade-in">
          <label className="field">
            <span>De</span>
            <input className="input" type="month" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label className="field">
            <span>Até</span>
            <input className="input" type="month" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
      )}

      <p className="print-only strong">Relatório · {periodLabel}</p>

      <section className="report-summary stagger">
        <div className="card card--tight">
          <span className="tiny muted strong">Ganhos</span>
          <strong className="num t-income">{brl(sum.income)}</strong>
        </div>
        <div className="card card--tight">
          <span className="tiny muted strong">Gastos</span>
          <strong className="num t-expense">{brl(sum.expense)}</strong>
        </div>
        <div className="card card--tight">
          <span className="tiny muted strong">Saldo</span>
          <strong className={`num ${sum.balance >= 0 ? 't-income' : 't-expense'}`}>{brl(sum.balance)}</strong>
        </div>
        <div className="card card--tight">
          <span className="tiny muted strong">Média de gastos/mês</span>
          <strong className="num">{brl(sum.expense / months.length)}</strong>
        </div>
      </section>

      {!periodTx.length ? (
        <div className="card">
          <EmptyState title="Sem dados no período" message="Escolha outro período ou comece a lançar ganhos e gastos." />
        </div>
      ) : (
        <>
          {months.length > 1 && (
            <section className="card stack">
              <h2 className="card-title">Evolução de ganhos x gastos</h2>
              <LineChart
                key={months.join()}
                labels={labels}
                series={[
                  { name: 'Ganhos', color: 'var(--income)', values: perMonth.map((p) => p.income) },
                  { name: 'Gastos', color: 'var(--expense)', values: perMonth.map((p) => p.expense) },
                ]}
              />
            </section>
          )}

          <section className="card stack">
            <h2 className="card-title">Ranking de categorias</h2>
            <ol className="ranking">
              {ranking.map((c, i) => (
                <li key={c.id}>
                  <span className="ranking-pos">{i + 1}</span>
                  <CategoryBubble category={c} size={34} />
                  <div className="grow stack-sm" style={{ gap: 4 }}>
                    <div className="row-between small">
                      <span className="strong ellipsis">{c.label}</span>
                      <span className="num strong">{brl(c.value)}</span>
                    </div>
                    <ProgressBar ratio={c.value / ranking[0].value} tone="brand" label={`${c.label}: ${Math.round((c.value / sum.expense) * 100)}% dos gastos`} height={7} />
                  </div>
                  <span className="tiny muted ranking-pct">{Math.round((c.value / sum.expense) * 100)}%</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="card stack">
            <h2 className="card-title">Comparativo mês a mês</h2>
            <BarChart
              key={months.join()}
              labels={labels}
              series={[
                { name: 'Ganhos', color: 'var(--income)', values: perMonth.map((p) => p.income) },
                { name: 'Gastos', color: 'var(--expense)', values: perMonth.map((p) => p.expense) },
              ]}
            />
            <div className="table-wrap">
              <table className="report-table">
                <caption className="tiny muted">Valores em R$</caption>
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col">Ganhos</th>
                    <th scope="col">Gastos</th>
                    <th scope="col">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {perMonth.map((p) => (
                    <tr key={p.m}>
                      <th scope="row">{monthLabel(p.m, { short: true })}</th>
                      <td className="num">{plain(p.income)}</td>
                      <td className="num">{plain(p.expense)}</td>
                      <td className={`num strong ${p.balance >= 0 ? 't-income' : 't-expense'}`}>{plain(p.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card stack">
            <h2 className="card-title">Gastos por pessoa</h2>
            {byPerson.map(([id, v]) => (
              <div key={id} className="row">
                <Avatar id={id} name={memberName(id)} src={members.find((m) => m.user_id === id)?.profiles?.avatar_url} size={34} />
                <div className="grow stack-sm" style={{ gap: 4 }}>
                  <div className="row-between small">
                    <span className="strong">{memberName(id)}</span>
                    <span className="num strong">{brl(v)}</span>
                  </div>
                  <ProgressBar ratio={v / sum.expense} tone="brand" label={`${memberName(id)}: ${Math.round((v / sum.expense) * 100)}%`} height={7} />
                </div>
              </div>
            ))}
          </section>

          {cards.length > 0 && (
            <section className="card stack">
              <h2 className="card-title">Gastos por cartão</h2>
              {byCard.length ? (
                byCard.map(([id, v]) => (
                  <div key={id} className="row-between list-item">
                    <span className="row" style={{ gap: 10 }}>
                      <span className="legend-dot" style={{ background: cardById.get(id)?.color, width: 14, height: 14 }} />
                      <span className="strong">{cardById.get(id)?.name || 'Cartão removido'}</span>
                    </span>
                    <span className="num strong">{brl(v)}</span>
                  </div>
                ))
              ) : (
                <p className="muted small">Nenhuma compra no cartão neste período.</p>
              )}
            </section>
          )}
        </>
      )}

      <div className="grid-2 no-print">
        <button type="button" className="btn" onClick={exportCSV} disabled={!periodTx.length}>
          <Download size={18} /> CSV
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          <Printer size={18} /> PDF
        </button>
      </div>
      {closing && <MonthClosing month={closing} open={Boolean(closing)} onClose={() => setClosing(null)} />}
    </div>
  )
}
