import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Landmark } from 'lucide-react'
import MoneyInput from './MoneyInput'
import CategoryPicker from './CategoryPicker'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import ReceiptField from './ReceiptField'
import { useLookups } from '../hooks/useLookups'
import { todayISO, monthLabel } from '../lib/dates'
import { brl } from '../lib/format'
import { invoiceMonthFor, splitInstallments } from '../lib/finance'
import './TransactionForm.css'

function initialState(type, tx, defaults) {
  if (tx) {
    return {
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description || '',
      category_id: tx.category_id || '',
      method: tx.card_id ? 'card' : 'account',
      account_id: tx.account_id || defaults.account_id,
      card_id: tx.card_id || defaults.card_id,
      date: tx.date,
      paid: tx.paid,
      recurring: false,
      installmentsOn: false,
      installments: 2,
      paid_by: tx.paid_by || tx.user_id || defaults.user_id,
      shared: tx.shared !== false,
    }
  }
  return {
    type,
    amount: 0,
    description: '',
    category_id: defaults.category_id,
    method: 'account',
    account_id: defaults.account_id,
    card_id: defaults.card_id,
    date: todayISO(),
    paid: true,
    recurring: false,
    installmentsOn: false,
    installments: 2,
    paid_by: defaults.user_id,
    shared: true,
  }
}

/**
 * Formulário de ganho/gasto. `onSubmit(form)` recebe:
 * { type, amount, description, category_id, account_id, card_id, date, paid, recurring, installments }
 */
export default function TransactionForm({ type, tx, onSubmit, submitLabel, busy, autoFocus = false }) {
  const { accounts, cards } = useData()
  const { user } = useAuth()
  const { members } = useHousehold()
  const { activeCategories, cardById } = useLookups()
  const uid = useId()
  const cats = activeCategories(type)
  const defaults = useMemo(
    () => ({ category_id: '', account_id: accounts[0]?.id || '', card_id: cards[0]?.id || '', user_id: user?.id }),
    [accounts, cards, user?.id],
  )
  const [f, setF] = useState(() => initialState(type, tx, defaults))
  const [errors, setErrors] = useState({})
  const set = (patch) => setF((s) => ({ ...s, ...patch }))
  const isExpense = type === 'expense'
  const isEdit = Boolean(tx)

  // contas/cartões podem chegar depois (cache/rede)
  useEffect(() => {
    setF((s) => ({ ...s, account_id: s.account_id || defaults.account_id, card_id: s.card_id || defaults.card_id }))
  }, [defaults])

  const card = f.method === 'card' ? cardById.get(f.card_id) : null
  const parts = f.installmentsOn && f.amount > 0 ? splitInstallments(f.amount, f.installments) : null

  const submit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!(f.amount > 0)) errs.amount = 'Informe um valor maior que zero.'
    if (!f.date) errs.date = 'Informe a data.'
    if (f.method === 'account' && !f.account_id && accounts.length) errs.account = 'Escolha a conta.'
    if (f.method === 'card' && !f.card_id) errs.account = 'Escolha o cartão.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    onSubmit({
      type,
      amount: f.amount,
      description: f.description,
      category_id: f.category_id || cats[cats.length - 1]?.id || null,
      account_id: f.method === 'account' ? f.account_id : null,
      card_id: isExpense && f.method === 'card' ? f.card_id : null,
      date: f.date,
      paid: f.paid,
      recurring: !isEdit && f.recurring,
      installments: !isEdit && isExpense && f.installmentsOn ? f.installments : 1,
      paid_by: isExpense ? f.paid_by : undefined,
      shared: isExpense ? f.shared : undefined,
    })
  }

  return (
    <form className="tx-form" onSubmit={submit} noValidate>
      <MoneyInput
        id={`${uid}-amount`}
        large
        tone={type}
        label={f.installmentsOn ? 'Valor total' : 'Valor'}
        value={f.amount}
        onChange={(amount) => set({ amount })}
        aria-invalid={Boolean(errors.amount)}
        data-autofocus={autoFocus || undefined}
      />
      {errors.amount && <span className="field-error">{errors.amount}</span>}

      <label className="field">
        <span>Descrição</span>
        <input
          className="input"
          value={f.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder={isExpense ? 'Ex.: Feira da semana' : 'Ex.: Salário de novembro'}
          maxLength={80}
          enterKeyHint="next"
        />
      </label>

      <CategoryPicker categories={cats} value={f.category_id} onChange={(category_id) => set({ category_id })} />

      {isExpense && (
        <div className="field">
          <span className="field-label">Forma de pagamento</span>
          <div className="segmented">
            <button type="button" aria-pressed={f.method === 'account'} onClick={() => set({ method: 'account' })}>
              <Landmark size={17} /> Conta
            </button>
            <button
              type="button"
              aria-pressed={f.method === 'card'}
              onClick={() => set({ method: 'card' })}
              disabled={!cards.length}
              title={cards.length ? undefined : 'Cadastre um cartão em Contas e cartões'}
            >
              <CreditCard size={17} /> Cartão
            </button>
          </div>
        </div>
      )}

      {f.method === 'account' || !isExpense ? (
        accounts.length ? (
          <label className="field">
            <span>{isExpense ? 'Conta' : 'Conta de destino'}</span>
            <select className="select" value={f.account_id} onChange={(e) => set({ account_id: e.target.value })}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="banner banner--info small">
            Nenhuma conta cadastrada. <Link to="/contas">Criar conta</Link>
          </p>
        )
      ) : (
        <label className="field">
          <span>Cartão</span>
          <select className="select" value={f.card_id} onChange={(e) => set({ card_id: e.target.value })}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      {errors.account && <span className="field-error">{errors.account}</span>}

      <div className="grid-2">
        <label className="field">
          <span>Data</span>
          <input className="input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} required />
        </label>
        {!card ? (
          <label className="switch tx-form-paid">
            <span>{isExpense ? 'Pago' : 'Recebido'}</span>
            <input type="checkbox" checked={f.paid} onChange={(e) => set({ paid: e.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
          </label>
        ) : (
          <div className="tx-form-hint small">
            <span className="muted">Entra na fatura de</span>
            <strong>{f.date ? monthLabel(invoiceMonthFor(f.date, card.closing_day)) : '—'}</strong>
          </div>
        )}
      </div>
      {errors.date && <span className="field-error">{errors.date}</span>}

      {isExpense && members.length > 1 && (
        <div className="tx-form-options card card--flat card--tight">
          <label className="field">
            <span>Pago por</span>
            <select className="select" value={f.paid_by} onChange={(e) => set({ paid_by: e.target.value })}>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.user_id === user?.id ? 'Eu' : m.profiles?.name || 'Membro'}</option>
              ))}
            </select>
          </label>
          <label className="switch">
            <span>
              Dividir com a casa
              <small className="muted block">{f.shared ? `Cada um paga ${members.length > 0 ? Math.round(100 / members.length) : 100}%` : 'Gasto pessoal, fora da divisão'}</small>
            </span>
            <input type="checkbox" checked={f.shared} onChange={(e) => set({ shared: e.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
          </label>
        </div>
      )}

      {isEdit && <ReceiptField tx={tx} />}

      {!isEdit && (
        <div className="tx-form-options card card--flat card--tight">
          <label className="switch">
            <span>
              Repetir todo mês
              <small className="muted"> (fixo)</small>
            </span>
            <input
              type="checkbox"
              checked={f.recurring}
              onChange={(e) => set({ recurring: e.target.checked, installmentsOn: false })}
            />
            <span className="switch-track" aria-hidden="true" />
          </label>
          {isExpense && (
            <>
              <hr className="divider" />
              <label className="switch">
                <span>Parcelado</span>
                <input
                  type="checkbox"
                  checked={f.installmentsOn}
                  onChange={(e) => set({ installmentsOn: e.target.checked, recurring: false })}
                />
                <span className="switch-track" aria-hidden="true" />
              </label>
              {f.installmentsOn && (
                <div className="row fade-in">
                  <label className="field grow">
                    <span>Número de parcelas</span>
                    <input
                      className="input"
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={48}
                      value={f.installments}
                      onChange={(e) => set({ installments: Math.max(2, Math.min(48, Number(e.target.value) || 2)) })}
                    />
                  </label>
                  {parts && (
                    <p className="tx-form-split">
                      {f.installments}× <strong className="num">{brl(parts[parts.length - 1])}</strong>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isEdit && (tx.installment_group_id || tx.recurring_id) && (
        <p className="banner banner--info small">
          {tx.installment_group_id
            ? `Parcela ${tx.installment_number}/${tx.installment_total}. Você poderá aplicar a mudança só nesta ou nas próximas.`
            : 'Lançamento fixo. Você poderá aplicar a mudança só neste ou nos próximos meses.'}
        </p>
      )}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <span className="spinner" aria-label="Salvando" /> : submitLabel || (isExpense ? 'Salvar gasto' : 'Salvar ganho')}
      </button>
    </form>
  )
}
