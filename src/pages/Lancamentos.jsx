import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, CircleArrowDown, CircleArrowUp, Funnel, List, Search, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import MonthPicker from '../components/MonthPicker'
import TransactionItem from '../components/TransactionItem'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import Sheet from '../components/Sheet'
import AnimatedNumber from '../components/AnimatedNumber'
import CalendarView from '../components/CalendarView'
import { SkeletonList } from '../components/Skeleton'
import { CategoryBubble } from '../components/CategoryIcon'
import { useData } from '../context/DataContext'
import { useHousehold } from '../context/HouseholdContext'
import { useQuickAdd } from '../context/QuickAddContext'
import { useMonth } from '../hooks/useMonth'
import { useTxEditor } from '../hooks/useTxEditor'
import { addMonths, formatDayHeader, monthName } from '../lib/dates'
import { brl, numberToCents, signedPct } from '../lib/format'
import { budgetProgress, isNormal, percentChange } from '../lib/finance'
import './Lancamentos.css'

const EMPTY_FILTERS = { category: '', source: '', status: '', member: '' }
const normalize = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const TYPES = [
  ['expense', 'Gastos'],
  ['income', 'Ganhos'],
  ['all', 'Todos'],
]

function applyFilters(list, type, f, q) {
  const nq = normalize(q.trim())
  return list.filter((t) => {
    if (!isNormal(t)) return false
    if (type !== 'all' && t.type !== type) return false
    if (f.category && t.category_id !== f.category) return false
    if (f.source) {
      const [kind, id] = f.source.split(':')
      if (kind === 'acc' && t.account_id !== id) return false
      if (kind === 'card' && t.card_id !== id) return false
    }
    if (f.status === 'paid' && !t.paid) return false
    if (f.status === 'pending' && t.paid) return false
    if (f.member && (t.paid_by || t.user_id) !== f.member && t.user_id !== f.member) return false
    if (nq && !normalize(t.description || '').includes(nq)) return false
    return true
  })
}

const signedTotal = (list) => list.reduce((a, t) => a + (t.type === 'income' ? 1 : -1) * numberToCents(t.amount), 0) / 100

export default function Lancamentos() {
  const { categories, accounts, cards, budgets, loading } = useData()
  const { members } = useHousehold()
  const { month, monthTx, prevTx } = useMonth()
  const quickAdd = useQuickAdd()
  const editor = useTxEditor()
  const [params, setParams] = useSearchParams()
  const type = ['expense', 'income', 'all'].includes(params.get('tipo')) ? params.get('tipo') : 'expense'
  const view = params.get('ver') === 'calendario' ? 'calendar' : 'list'
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [sheet, setSheet] = useState(false)
  const [day, setDay] = useState(null)

  const setParam = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => applyFilters(monthTx, type, filters, q), [monthTx, type, filters, q])
  const prevFiltered = useMemo(() => applyFilters(prevTx, type, filters, q), [prevTx, type, filters, q])
  const total = signedTotal(filtered)
  const prevTotal = signedTotal(prevFiltered)
  const change = percentChange(Math.abs(total), Math.abs(prevTotal))
  const shown = view === 'calendar' && day ? filtered.filter((t) => t.date === day) : filtered

  const groups = useMemo(() => {
    const map = new Map()
    for (const t of shown) {
      if (!map.has(t.date)) map.set(t.date, [])
      map.get(t.date).push(t)
    }
    return [...map.entries()]
  }, [shown])

  const progress = useMemo(() => budgetProgress(budgets, categories, monthTx), [budgets, categories, monthTx])
  const activeCount = Object.values(filters).filter(Boolean).length
  const catById = new Map(categories.map((c) => [c.id, c]))
  const chips = [
    filters.category && { key: 'category', label: catById.get(filters.category)?.name },
    filters.source && {
      key: 'source',
      label: filters.source.startsWith('acc')
        ? accounts.find((a) => `acc:${a.id}` === filters.source)?.name
        : cards.find((c) => `card:${c.id}` === filters.source)?.name,
    },
    filters.status && { key: 'status', label: filters.status === 'paid' ? 'Pagos' : 'Pendentes' },
    filters.member && { key: 'member', label: members.find((m) => m.user_id === filters.member)?.profiles?.name },
  ].filter(Boolean)

  const prevName = monthName(addMonths(month, -1))

  return (
    <div className="page lanc">
      <PageHeader
        title="Lançamentos"
        subtitle="Ganhos, gastos e o controle do mês"
        actions={
          <>
            <button type="button" className="btn btn-sm lanc-add-btn" onClick={() => quickAdd.open('income')}>
              <CircleArrowUp size={17} /> <span>Novo ganho</span>
            </button>
            <button type="button" className="btn btn-sm btn-primary lanc-add-btn" onClick={() => quickAdd.open('expense')}>
              <CircleArrowDown size={17} /> <span>Novo gasto</span>
            </button>
          </>
        }
      />

      <div className="lanc-grid">
        <aside className="lanc-side stack">
          <MonthPicker />

          <section className="card lanc-total">
            <div>
              <p className="tiny muted strong">Total {activeCount || q ? 'do filtro' : TYPES.find(([v]) => v === type)[1].toLowerCase()}</p>
              <AnimatedNumber value={Math.abs(total)} className={`display-num lanc-total-value ${type === 'income' ? 't-income' : type === 'expense' ? 't-expense' : ''}`} />
            </div>
            <div className="lanc-compare">
              {change == null ? (
                <span className="tiny muted">Sem dados de {prevName}</span>
              ) : (
                <>
                  <span className={`badge ${(type === 'income' ? change >= 0 : change <= 0) ? 'badge--income' : 'badge--expense'}`}>{signedPct(change)}</span>
                  <span className="tiny muted">vs. {prevName} ({brl(Math.abs(prevTotal))})</span>
                </>
              )}
            </div>
          </section>

          {type !== 'income' && progress.length > 0 && (
            <section className="card stack lanc-budgets">
              <div className="row-between">
                <h2 className="card-title">Metas do mês</h2>
                <Link to="/metas" className="tiny strong">Editar</Link>
              </div>
              {progress.slice(0, 5).map((b) => (
                <div key={b.id} className="row">
                  <CategoryBubble category={b.category} size={32} />
                  <div className="grow stack-sm" style={{ gap: 4 }}>
                    <div className="row-between small">
                      <span className="strong">{b.category.name}</span>
                      <span className="num muted">{brl(b.spent)} / {brl(b.monthly_limit)}</span>
                    </div>
                    <ProgressBar ratio={b.ratio} label={`Meta de ${b.category.name}: ${Math.round(b.ratio * 100)}%`} height={7} />
                  </div>
                </div>
              ))}
            </section>
          )}
        </aside>

        <section className="lanc-main stack">
          <div className="segmented" role="group" aria-label="Tipo">
            {TYPES.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={type === v} onClick={() => setParam('tipo', v === 'expense' ? null : v)}>
                {l}
              </button>
            ))}
          </div>

          <div className="lanc-tools">
            <label className="search">
              <Search size={18} aria-hidden="true" />
              <input className="search-input" type="search" placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar lançamentos" />
            </label>
            <button
              type="button"
              className="icon-btn filter-btn"
              onClick={() => {
                setDraft(filters)
                setSheet(true)
              }}
              aria-label={`Filtros${activeCount ? ` (${activeCount} ativos)` : ''}`}
            >
              <Funnel size={20} />
              {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
            </button>
            <div className="view-toggle" role="group" aria-label="Visualização">
              <button type="button" className="icon-btn" aria-pressed={view === 'list'} onClick={() => setParam('ver', null)} aria-label="Ver em lista">
                <List size={20} />
              </button>
              <button type="button" className="icon-btn" aria-pressed={view === 'calendar'} onClick={() => setParam('ver', 'calendario')} aria-label="Ver calendário">
                <CalendarDays size={20} />
              </button>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="chips">
              {chips.map((c) => (
                <button key={c.key} type="button" className="chip is-active" onClick={() => setFilters((f) => ({ ...f, [c.key]: '' }))} aria-label={`Remover filtro ${c.label}`}>
                  {c.label} <X size={14} />
                </button>
              ))}
            </div>
          )}

          {view === 'calendar' && (
            <section className="card">
              <CalendarView month={month} transactions={filtered} selected={day} onSelect={setDay} />
            </section>
          )}

          {view === 'calendar' && day && (
            <div className="row-between">
              <h2 className="section-title">{formatDayHeader(day)}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDay(null)}>Ver mês todo</button>
            </div>
          )}

          {loading ? (
            <div className="card"><SkeletonList rows={5} /></div>
          ) : groups.length ? (
            <div className="stack">
              {groups.map(([date, items]) => {
                const dayTotal = signedTotal(items)
                return (
                  <section key={date} className="card card--tight day-group">
                    <header className="row-between day-header">
                      <h3>{formatDayHeader(date)}</h3>
                      <span className={`small strong num ${dayTotal >= 0 ? 't-income' : 't-expense'}`}>{dayTotal >= 0 ? '+' : '−'} {brl(Math.abs(dayTotal))}</span>
                    </header>
                    <div className="list">
                      {items.map((t) => (
                        <TransactionItem key={t.id} tx={t} showDate={false} onEdit={editor.editTx} onDelete={editor.deleteTx} onTogglePaid={editor.togglePaid} />
                      ))}
                    </div>
                  </section>
                )
              })}
              <p className="tiny muted lanc-hint">Dica: deslize um item para a esquerda para editar ou excluir; toque no ícone para marcar como pago.</p>
            </div>
          ) : (
            <div className="card">
              <EmptyState
                title={q || activeCount || day ? 'Nada encontrado' : 'Sem lançamentos neste mês'}
                message={q || activeCount ? 'Tente outros filtros ou limpe a busca.' : 'Toque em “Gasto” ou “Ganho” para lançar.'}
                variant="list"
                action={!q && !activeCount ? (
                  <button type="button" className="btn btn-primary" onClick={() => quickAdd.open(type === 'income' ? 'income' : 'expense')}>
                    Novo lançamento
                  </button>
                ) : null}
              />
            </div>
          )}
        </section>
      </div>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtros"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDraft(EMPTY_FILTERS)}>Limpar</button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFilters(draft)
                setSheet(false)
              }}
            >
              Aplicar
            </button>
          </>
        }
      >
        <div className="stack">
          <label className="field">
            <span>Categoria</span>
            <select className="select" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="">Todas</option>
              {categories
                .filter((c) => type === 'all' || c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.type === 'income' && type === 'all' ? ' (ganho)' : ''}</option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Conta ou cartão</span>
            <select className="select" value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
              <option value="">Todos</option>
              <optgroup label="Contas">
                {accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
              </optgroup>
              {cards.length > 0 && (
                <optgroup label="Cartões">
                  {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name}</option>)}
                </optgroup>
              )}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Situação</span>
            <div className="segmented">
              {[
                ['', 'Todos'],
                ['paid', 'Pagos'],
                ['pending', 'Pendentes'],
              ].map(([v, l]) => (
                <button key={v} type="button" aria-pressed={draft.status === v} onClick={() => setDraft({ ...draft, status: v })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {members.length > 1 && (
            <label className="field">
              <span>Pessoa (quem lançou ou pagou)</span>
              <select className="select" value={draft.member} onChange={(e) => setDraft({ ...draft, member: e.target.value })}>
                <option value="">Todos</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.name || 'Membro'}</option>)}
              </select>
            </label>
          )}
        </div>
      </Sheet>
      {editor.sheet}
    </div>
  )
}
