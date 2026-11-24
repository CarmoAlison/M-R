import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Handshake, Plus, Trash, UserPlus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import MonthPicker from '../components/MonthPicker'
import Sheet from '../components/Sheet'
import MoneyInput from '../components/MoneyInput'
import Avatar from '../components/Avatar'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useToast } from '../context/ToastContext'
import { useMonth } from '../hooks/useMonth'
import { formatDate, monthLabel, todayISO } from '../lib/dates'
import { brl, firstName, numberToCents, uuid } from '../lib/format'
import { isNormal } from '../lib/finance'
import { payerOf, settleUp, splitBalances } from '../lib/split'
import './Divisao.css'

export default function Divisao() {
  const data = useData()
  const { transactions, settlements } = data
  const { user } = useAuth()
  const { members } = useHousehold()
  const { month, monthTx } = useMonth()
  const toast = useToast()
  const [form, setForm] = useState(null)

  const ids = useMemo(() => members.map((m) => m.user_id), [members])
  const nameOf = (id) => (id === user?.id ? 'Você' : firstName(members.find((m) => m.user_id === id)?.profiles?.name || 'Ex-membro'))
  const member = (id) => members.find((m) => m.user_id === id)

  const balances = useMemo(() => splitBalances(transactions, settlements, ids), [transactions, settlements, ids])
  const transfers = useMemo(() => settleUp(balances), [balances])

  const monthShared = useMemo(() => {
    const list = monthTx.filter((t) => t.type === 'expense' && isNormal(t) && t.shared !== false)
    const total = list.reduce((a, t) => a + numberToCents(t.amount), 0) / 100
    const byPayer = new Map(ids.map((id) => [id, 0]))
    for (const t of list) {
      const p = payerOf(t)
      if (byPayer.has(p)) byPayer.set(p, byPayer.get(p) + numberToCents(t.amount))
    }
    const personal = monthTx.filter((t) => t.type === 'expense' && isNormal(t) && t.shared === false)
    return {
      total,
      byPayer: [...byPayer.entries()].map(([id, c]) => ({ id, value: c / 100 })),
      personal: personal.reduce((a, t) => a + numberToCents(t.amount), 0) / 100,
    }
  }, [monthTx, ids])

  const history = [...settlements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)

  const save = async (e) => {
    e.preventDefault()
    if (form.from === form.to) return toast.error('Escolha duas pessoas diferentes.')
    if (!(form.amount > 0)) return toast.error('Informe o valor.')
    try {
      await data.insert('settlements', {
        id: uuid(),
        from_user: form.from,
        to_user: form.to,
        amount: form.amount,
        date: form.date,
        note: form.note.trim(),
        created_by: user.id,
      })
      toast.success('Acerto registrado 🤝')
      setForm(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const remove = async (s) => {
    try {
      await data.remove('settlements', s.id)
      toast.success('Acerto removido')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (members.length < 2) {
    return (
      <div className="page page--narrow">
        <PageHeader title="Divisão do casal" back />
        <div className="card">
          <EmptyState
            title="Convide quem divide as contas com você"
            message="Com duas ou mais pessoas na casa, o app calcula quem pagou o quê e quem deve quanto a quem."
            action={<Link to="/familia" className="btn btn-primary"><UserPlus size={18} /> Convidar</Link>}
          />
        </div>
      </div>
    )
  }

  const newForm = (t) => ({ from: t?.from || ids.find((i) => i !== user.id) || ids[0], to: t?.to || user.id, amount: t?.amount || 0, date: todayISO(), note: '' })

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Divisão do casal"
        subtitle="Quem pagou o quê e quem deve a quem"
        back
        actions={
          <button type="button" className="btn btn-sm" onClick={() => setForm(newForm())}>
            <Plus size={18} /> Acerto
          </button>
        }
      />

      <section className="card stack split-summary">
        <h2 className="card-title">Situação atual</h2>
        {transfers.length ? (
          transfers.map((t, i) => (
            <div key={i} className="split-transfer">
              <div className="row">
                <Avatar id={t.from} name={member(t.from)?.profiles?.name} src={member(t.from)?.profiles?.avatar_url} size={40} />
                <div className="grow">
                  <p>
                    <strong>{nameOf(t.from)}</strong> deve para <strong>{nameOf(t.to)}</strong>
                  </p>
                  <p className="display-num split-amount t-expense">{brl(t.amount)}</p>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-primary btn-block" onClick={() => setForm(newForm(t))}>
                <Handshake size={16} /> Registrar acerto
              </button>
            </div>
          ))
        ) : (
          <div className="split-even">
            <Handshake size={26} />
            <p className="strong">Tudo certo! Ninguém deve nada a ninguém.</p>
          </div>
        )}
        <p className="tiny muted">Considera todos os gastos marcados como “dividir com a casa”, em partes iguais, e os acertos já registrados.</p>
      </section>

      <section className="card stack">
        <h2 className="card-title">Saldo de cada um</h2>
        {balances.map((b) => (
          <div key={b.user_id} className="split-member">
            <Avatar id={b.user_id} name={member(b.user_id)?.profiles?.name} src={member(b.user_id)?.profiles?.avatar_url} size={36} />
            <div className="grow">
              <div className="row-between">
                <p className="strong">{nameOf(b.user_id)}</p>
                <span className={`badge ${b.balance > 0.004 ? 'badge--income' : b.balance < -0.004 ? 'badge--expense' : ''}`}>
                  {b.balance > 0.004 ? 'a receber' : b.balance < -0.004 ? 'a pagar' : 'em dia'}
                </span>
              </div>
              <p className={`num strong ${b.balance > 0.004 ? 't-income' : b.balance < -0.004 ? 't-expense' : 'muted'}`}>{brl(Math.abs(b.balance))}</p>
              <p className="tiny muted">Pagou <span className="num">{brl(b.paid)}</span> · parte: <span className="num">{brl(b.share)}</span></p>
            </div>
          </div>
        ))}
      </section>

      <MonthPicker />
      <section className="card stack">
        <div>
          <h2 className="card-title">Gastos divididos em {monthLabel(month, { withYear: false }).toLowerCase()}</h2>
          <p className="display-num split-month-total">{brl(monthShared.total)}</p>
        </div>
        {monthShared.byPayer.map(({ id, value }) => (
          <div key={id} className="stack-sm" style={{ gap: 4 }}>
            <div className="row-between small">
              <span className="strong">{nameOf(id)} pagou</span>
              <span className="num">{brl(value)} <span className="muted">({monthShared.total ? Math.round((value / monthShared.total) * 100) : 0}%)</span></span>
            </div>
            <ProgressBar ratio={monthShared.total ? value / monthShared.total : 0} tone="brand" label={`${nameOf(id)} pagou ${brl(value)}`} height={8} />
          </div>
        ))}
        {monthShared.personal > 0 && <p className="tiny muted">Gastos pessoais (fora da divisão) neste mês: {brl(monthShared.personal)}</p>}
      </section>

      {history.length > 0 && (
        <>
          <h2 className="section-title">Acertos registrados</h2>
          <section className="card list">
            {history.map((s) => (
              <div key={s.id} className="list-item">
                <span className="grow">
                  <span className="split-hist">
                    <strong>{nameOf(s.from_user)}</strong> <ArrowRight size={14} /> <strong>{nameOf(s.to_user)}</strong>
                  </span>
                  <span className="tiny muted block">{formatDate(s.date)}{s.note ? ` · ${s.note}` : ''}</span>
                </span>
                <span className="num strong">{brl(s.amount)}</span>
                <button type="button" className="icon-btn" onClick={() => remove(s)} aria-label="Remover acerto"><Trash size={16} /></button>
              </div>
            ))}
          </section>
        </>
      )}

      <Sheet open={Boolean(form)} onClose={() => setForm(null)} title="Registrar acerto">
        {form && (
          <form className="stack" onSubmit={save}>
            <div className="grid-2">
              <label className="field">
                <span>Quem pagou</span>
                <select className="select" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
                  {ids.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Para quem</span>
                <select className="select" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
                  {ids.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
              </label>
            </div>
            <MoneyInput large value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
            <div className="grid-2">
              <label className="field">
                <span>Data</span>
                <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
              <label className="field">
                <span>Observação</span>
                <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={80} placeholder="ex.: Pix" />
              </label>
            </div>
            <button className="btn btn-primary btn-block">Registrar</button>
          </form>
        )}
      </Sheet>
    </div>
  )
}
