import { useMemo, useState } from 'react'
import { Minus, Pencil, Plus, Trash } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import MoneyInput from '../components/MoneyInput'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import ColorPicker from '../components/ColorPicker'
import Avatar from '../components/Avatar'
import AnimatedNumber from '../components/AnimatedNumber'
import CategoryIcon, { CATEGORY_COLORS } from '../components/CategoryIcon'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { currentMonth, formatDate, monthRange, todayISO } from '../lib/dates'
import { brl, numberToCents, uuid } from '../lib/format'
import './Objetivos.css'

const GOAL_ICONS = ['piggy-bank', 'plane', 'house', 'car', 'graduation-cap', 'gift', 'baby', 'heart-pulse', 'laptop', 'sofa', 'paw-print', 'sparkles']

function monthsUntil(dateISO) {
  if (!dateISO) return null
  return Math.max(1, monthRange(currentMonth(), dateISO.slice(0, 7)).length)
}

export default function Objetivos() {
  const data = useData()
  const { goals, goalEntries } = data
  const { user } = useAuth()
  const { memberById } = useHousehold()
  const toast = useToast()
  const confirm = useConfirm()
  const [form, setForm] = useState(null) // criar/editar objetivo
  const [entry, setEntry] = useState(null) // { goal, sign: 1 | -1, amount, date, note }
  const [detail, setDetail] = useState(null) // goal id
  const [showArchived, setShowArchived] = useState(false)

  const list = useMemo(() => {
    const saved = new Map()
    for (const e of goalEntries) saved.set(e.goal_id, (saved.get(e.goal_id) || 0) + numberToCents(e.amount))
    return goals
      .map((g) => {
        const value = (saved.get(g.id) || 0) / 100
        const left = Math.max(0, Number(g.target_amount) - value)
        const months = monthsUntil(g.target_date)
        return { ...g, saved: value, left, ratio: value / Number(g.target_amount), perMonth: months ? left / months : null }
      })
      .sort((a, b) => Number(a.archived) - Number(b.archived) || b.ratio - a.ratio)
  }, [goals, goalEntries])

  const visible = list.filter((g) => showArchived || !g.archived)
  const totalSaved = list.filter((g) => !g.archived).reduce((a, g) => a + g.saved, 0)
  const goal = list.find((g) => g.id === detail)
  const history = goalEntries.filter((e) => e.goal_id === detail).sort((a, b) => b.date.localeCompare(a.date))

  const saveGoal = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Dê um nome ao objetivo.')
    if (!(form.target_amount > 0)) return toast.error('Informe quanto querem juntar.')
    const row = {
      name: form.name.trim(),
      target_amount: form.target_amount,
      target_date: form.target_date || null,
      icon: form.icon,
      color: form.color,
    }
    try {
      if (form.id) await data.update('goals', form.id, row)
      else await data.insert('goals', { id: uuid(), created_by: user.id, ...row })
      toast.success(form.id ? 'Objetivo atualizado' : 'Objetivo criado 🎯')
      setForm(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const saveEntry = async (e) => {
    e.preventDefault()
    if (!(entry.amount > 0)) return toast.error('Informe o valor.')
    if (entry.sign < 0 && entry.amount > entry.goal.saved) return toast.error('O valor é maior do que o guardado nesta caixinha.')
    try {
      await data.insert('goal_entries', {
        id: uuid(),
        goal_id: entry.goal.id,
        user_id: user.id,
        amount: entry.sign * entry.amount,
        date: entry.date,
        note: entry.note.trim(),
      })
      const reached = entry.sign > 0 && entry.goal.saved + entry.amount >= Number(entry.goal.target_amount) && entry.goal.saved < Number(entry.goal.target_amount)
      toast.success(reached ? `Objetivo “${entry.goal.name}” alcançado! 🎉` : entry.sign > 0 ? 'Valor guardado' : 'Retirada registrada')
      setEntry(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const removeEntry = async (en) => {
    try {
      await data.remove('goal_entries', en.id)
      toast.success('Movimentação removida')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const removeGoal = async (g) => {
    const ok = await confirm({
      title: `Excluir “${g.name}”?`,
      message: 'O objetivo e todo o histórico dele serão apagados. Se só quiser tirar da lista, use “Arquivar”.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await data.remove('goals', g.id)
      setDetail(null)
      setForm(null)
      toast.success('Objetivo excluído')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const openEntry = (g, sign) => setEntry({ goal: g, sign, amount: 0, date: todayISO(), note: '' })

  return (
    <div className="page">
      <PageHeader
        title="Objetivos"
        subtitle="Caixinhas para juntar dinheiro"
        back
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ name: '', target_amount: 0, target_date: '', icon: 'piggy-bank', color: CATEGORY_COLORS[0] })}>
            <Plus size={18} /> Novo
          </button>
        }
      />

      {list.some((g) => !g.archived) && (
        <section className="card goals-total">
          <span className="tiny muted strong">Guardado nas caixinhas</span>
          <AnimatedNumber value={totalSaved} className="display-num goals-total-value" />
        </section>
      )}

      {visible.length ? (
        <div className="goals-grid stagger">
          {visible.map((g) => {
            const done = g.ratio >= 1
            return (
              <article key={g.id} className={`card goal-card ${g.archived ? 'is-archived' : ''}`} style={{ '--goal': g.color }}>
                <button type="button" className="goal-head" onClick={() => setDetail(g.id)}>
                  <span className="goal-icon"><CategoryIcon name={g.icon} size={22} /></span>
                  <span className="grow">
                    <span className="strong block ellipsis">{g.name}</span>
                    <span className="tiny muted">
                      {g.target_date ? `até ${formatDate(g.target_date, { month: 'short', year: 'numeric' })}` : 'sem prazo'}
                      {g.archived && ' · arquivado'}
                    </span>
                  </span>
                  <span className={`badge ${done ? 'badge--income' : 'badge--brand'}`}>{Math.round(Math.min(1, g.ratio) * 100)}%</span>
                </button>
                <div className="goal-values">
                  <span className="display-num goal-saved">{brl(g.saved)}</span>
                  <span className="small muted">de {brl(g.target_amount)}</span>
                </div>
                <div className="goal-bar">
                  <ProgressBar ratio={g.ratio} tone={done ? 'ok' : 'brand'} label={`${g.name}: ${Math.round(g.ratio * 100)}%`} height={10} />
                </div>
                <p className="tiny muted">
                  {done
                    ? 'Objetivo alcançado! 🎉'
                    : g.perMonth
                      ? `Faltam ${brl(g.left)} · guarde ${brl(g.perMonth)}/mês para chegar no prazo`
                      : `Faltam ${brl(g.left)}`}
                </p>
                {!g.archived && (
                  <div className="goal-actions">
                    <button type="button" className="btn btn-sm" onClick={() => openEntry(g, -1)} disabled={g.saved <= 0}>
                      <Minus size={16} /> Retirar
                    </button>
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => openEntry(g, 1)}>
                      <Plus size={16} /> Guardar
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="Nenhum objetivo ainda"
            message="Crie caixinhas para a reserva de emergência, a viagem dos sonhos, o carro novo… e acompanhem juntos."
            action={
              <button type="button" className="btn btn-primary" onClick={() => setForm({ name: 'Reserva de emergência', target_amount: 0, target_date: '', icon: 'piggy-bank', color: CATEGORY_COLORS[0] })}>
                <Plus size={18} /> Criar primeiro objetivo
              </button>
            }
          />
        </div>
      )}

      {list.some((g) => g.archived) && (
        <label className="switch small">
          <span>Mostrar arquivados</span>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
        </label>
      )}

      <p className="tiny muted goals-note">
        As caixinhas acompanham quanto vocês separaram para cada objetivo. Elas não mexem no saldo das contas; se o dinheiro sair da conta corrente, lance também uma transferência ou gasto.
      </p>

      {/* ---------- criar/editar */}
      <Sheet open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? 'Editar objetivo' : 'Novo objetivo'}>
        {form && (
          <form className="stack" onSubmit={saveGoal}>
            <label className="field">
              <span>Nome</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="Ex.: Viagem para a praia" data-autofocus />
            </label>
            <MoneyInput label="Quanto querem juntar" value={form.target_amount} onChange={(v) => setForm({ ...form, target_amount: v })} />
            <label className="field">
              <span>Até quando (opcional)</span>
              <input className="input" type="date" value={form.target_date || ''} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </label>
            <div className="field">
              <span className="field-label">Ícone</span>
              <div className="goal-icon-grid" role="radiogroup" aria-label="Ícone">
                {GOAL_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={form.icon === i}
                    aria-label={i}
                    className="goal-icon-choice"
                    style={form.icon === i ? { background: `${form.color}22`, color: form.color, borderColor: form.color } : undefined}
                    onClick={() => setForm({ ...form, icon: i })}
                  >
                    <CategoryIcon name={i} size={20} />
                  </button>
                ))}
              </div>
            </div>
            <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
            <button className="btn btn-primary btn-block">Salvar</button>
            {form.id && (
              <div className="grid-2">
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    await data.update('goals', form.id, { archived: !form.archived }).catch((err) => toast.error(err.message))
                    toast.success(form.archived ? 'Objetivo reativado' : 'Objetivo arquivado')
                    setForm(null)
                  }}
                >
                  {form.archived ? 'Reativar' : 'Arquivar'}
                </button>
                <button type="button" className="btn btn-danger" onClick={() => removeGoal(form)}>Excluir</button>
              </div>
            )}
          </form>
        )}
      </Sheet>

      {/* ---------- guardar/retirar */}
      <Sheet open={Boolean(entry)} onClose={() => setEntry(null)} title={entry ? `${entry.sign > 0 ? 'Guardar em' : 'Retirar de'} “${entry.goal.name}”` : ''}>
        {entry && (
          <form className="stack" onSubmit={saveEntry}>
            <MoneyInput large tone={entry.sign > 0 ? 'income' : 'expense'} value={entry.amount} onChange={(amount) => setEntry({ ...entry, amount })} data-autofocus />
            <div className="grid-2">
              <label className="field">
                <span>Data</span>
                <input className="input" type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
              </label>
              <label className="field">
                <span>Observação</span>
                <input className="input" value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} maxLength={80} placeholder="opcional" />
              </label>
            </div>
            <p className="tiny muted">Guardado hoje: {brl(entry.goal.saved)} de {brl(entry.goal.target_amount)}</p>
            <button className="btn btn-primary btn-block">{entry.sign > 0 ? 'Guardar' : 'Retirar'}</button>
          </form>
        )}
      </Sheet>

      {/* ---------- detalhes / histórico */}
      <Sheet open={Boolean(goal)} onClose={() => setDetail(null)} title={goal?.name}>
        {goal && (
          <div className="stack">
            <div className="row-between">
              <span className="display-num goal-saved">{brl(goal.saved)}</span>
              <span className="small muted">de {brl(goal.target_amount)}</span>
            </div>
            <ProgressBar ratio={goal.ratio} tone={goal.ratio >= 1 ? 'ok' : 'brand'} label={`${Math.round(goal.ratio * 100)}%`} height={10} />
            <div className="grid-2">
              <button type="button" className="btn" onClick={() => { setDetail(null); setForm({ ...goal, target_amount: Number(goal.target_amount), target_date: goal.target_date || '' }) }}>
                <Pencil size={16} /> Editar
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { setDetail(null); openEntry(goal, 1) }}>
                <Plus size={16} /> Guardar
              </button>
            </div>
            <p className="section-title">Histórico</p>
            {history.length ? (
              <div className="list">
                {history.map((en) => {
                  const who = memberById.get(en.user_id)
                  return (
                    <div key={en.id} className="list-item">
                      <Avatar id={en.user_id} name={who?.profiles?.name} src={who?.profiles?.avatar_url} size={30} />
                      <div className="grow">
                        <p className="small strong">{en.amount > 0 ? 'Guardou' : 'Retirou'}{en.note ? ` · ${en.note}` : ''}</p>
                        <p className="tiny muted">{formatDate(en.date, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className={`num strong ${en.amount > 0 ? 't-income' : 't-expense'}`}>{en.amount > 0 ? '+' : '−'} {brl(Math.abs(en.amount))}</span>
                      <button type="button" className="icon-btn" onClick={() => removeEntry(en)} aria-label="Remover movimentação"><Trash size={16} /></button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="small muted">Nenhuma movimentação ainda.</p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
