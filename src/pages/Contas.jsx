import { useMemo, useState } from 'react'
import { CreditCard, Landmark, PiggyBank, Plus, Wallet } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import MoneyInput from '../components/MoneyInput'
import ProgressBar from '../components/ProgressBar'
import EmptyState from '../components/EmptyState'
import AnimatedNumber from '../components/AnimatedNumber'
import TransactionItem from '../components/TransactionItem'
import { CATEGORY_COLORS } from '../components/CategoryIcon'
import ColorPicker from '../components/ColorPicker'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useFinanceActions } from '../hooks/useFinanceActions'
import { useTxEditor } from '../hooks/useTxEditor'
import { formatDate, monthLabel, todayISO } from '../lib/dates'
import { brl, sum, uuid } from '../lib/format'
import { accountBalance, cardInvoices, cardUsed, currentInvoiceKey } from '../lib/finance'
import './Contas.css'

const ACCOUNT_TYPES = { checking: ['Corrente', Landmark], savings: ['Poupança', PiggyBank], wallet: ['Carteira', Wallet] }
const STATUS = { open: 'Aberta', closed: 'Fechada', overdue: 'Vencida', paid: 'Paga', future: 'Futura' }

export default function Contas() {
  const data = useData()
  const { accounts, cards, transactions } = data
  const toast = useToast()
  const confirm = useConfirm()
  const { payInvoice } = useFinanceActions()
  const editor = useTxEditor()
  const [accForm, setAccForm] = useState(null)
  const [cardForm, setCardForm] = useState(null)
  const [detail, setDetail] = useState(null) // card id
  const [invoiceKey, setInvoiceKey] = useState(null)
  const [payFrom, setPayFrom] = useState('')
  const [busy, setBusy] = useState(false)

  const balances = useMemo(() => accounts.map((a) => ({ ...a, balance: accountBalance(a, transactions) })), [accounts, transactions])
  const totalBalance = sum(balances, (a) => a.balance)

  const saveAccount = async (e) => {
    e.preventDefault()
    const f = accForm
    if (!f.name.trim()) return toast.error('Dê um nome para a conta.')
    setBusy(true)
    try {
      const row = { name: f.name.trim(), type: f.type, initial_balance: f.initial_balance, color: f.color }
      if (f.id) await data.update('accounts', f.id, row)
      else await data.insert('accounts', { id: uuid(), ...row })
      toast.success(f.id ? 'Conta atualizada' : 'Conta criada')
      setAccForm(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveCard = async (e) => {
    e.preventDefault()
    const f = cardForm
    if (!f.name.trim()) return toast.error('Dê um nome para o cartão.')
    const closing = Number(f.closing_day)
    const due = Number(f.due_day)
    if (!(closing >= 1 && closing <= 31 && due >= 1 && due <= 31)) return toast.error('Dias de fechamento e vencimento devem estar entre 1 e 31.')
    setBusy(true)
    try {
      const row = { name: f.name.trim(), credit_limit: f.credit_limit, closing_day: closing, due_day: due, payment_account_id: f.payment_account_id || null, color: f.color }
      if (f.id) {
        await data.update('credit_cards', f.id, row)
        if (closing !== cards.find((c) => c.id === f.id)?.closing_day) {
          // recalcula a fatura das compras em aberto (o gatilho do banco faz o cálculo)
          const ids = transactions.filter((t) => t.card_id === f.id && !t.paid && t.kind === 'normal').map((t) => t.id)
          if (ids.length) await data.update('transactions', ids, { card_id: f.id })
          data.refetch('transactions').catch(() => {})
        }
      } else await data.insert('credit_cards', { id: uuid(), ...row })
      toast.success(f.id ? 'Cartão atualizado' : 'Cartão criado')
      setCardForm(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeItem = async (table, item, label) => {
    const ok = await confirm({ title: `Excluir ${label}?`, message: `“${item.name}” será removido. Isso só é possível se não houver lançamentos vinculados.`, confirmLabel: 'Excluir', tone: 'danger' })
    if (!ok) return
    try {
      await data.remove(table, item.id)
      toast.success(`${label[0].toUpperCase() + label.slice(1)} excluído(a)`)
      setAccForm(null)
      setCardForm(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ------------------------------------------------ detalhe do cartão
  const card = cards.find((c) => c.id === detail)
  const invoices = card ? cardInvoices(card, transactions) : []
  const activeKey = invoiceKey || (card && (invoices.find((i) => i.status === 'overdue' || i.status === 'closed')?.key || currentInvoiceKey(card)))
  const invoice = invoices.find((i) => i.key === activeKey)

  const openDetail = (c) => {
    setDetail(c.id)
    setInvoiceKey(null)
    setPayFrom(c.payment_account_id || accounts[0]?.id || '')
  }

  const pay = async () => {
    if (!payFrom) return toast.error('Escolha a conta de pagamento.')
    const ok = await confirm({
      title: 'Pagar fatura?',
      message: `Será lançada uma saída de ${brl(invoice.open)} na conta escolhida e os itens serão marcados como pagos.`,
      confirmLabel: 'Pagar fatura',
    })
    if (!ok) return
    try {
      await payInvoice(card, invoice, payFrom, todayISO())
      toast.success('Fatura paga! 🎉')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Contas e cartões" back />

      <section className="card total-card">
        <span className="tiny muted strong">Saldo total nas contas</span>
        <AnimatedNumber value={totalBalance} className={`total-value ${totalBalance < 0 ? 't-expense' : ''}`} />
      </section>

      <div className="row-between">
        <h2 className="section-title">Contas</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccForm({ name: '', type: 'checking', initial_balance: 0, color: CATEGORY_COLORS[0] })}>
          <Plus size={18} /> Nova conta
        </button>
      </div>
      {balances.length ? (
        <div className="stack-sm stagger">
          {balances.map((a) => {
            const [label, Icon] = ACCOUNT_TYPES[a.type] || ACCOUNT_TYPES.checking
            return (
              <button key={a.id} type="button" className="card card--tight account-row" onClick={() => setAccForm({ ...a, initial_balance: Number(a.initial_balance) })}>
                <span className="icon-bubble" style={{ background: `${a.color}26`, color: a.color }}><Icon size={20} /></span>
                <span className="grow">
                  <span className="strong block">{a.name}</span>
                  <span className="tiny muted">{label}</span>
                </span>
                <span className={`num strong ${a.balance < 0 ? 't-expense' : ''}`}>{brl(a.balance)}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="card"><EmptyState title="Nenhuma conta" message="Cadastre a conta corrente, poupança ou a carteira." /></div>
      )}

      <div className="row-between">
        <h2 className="section-title">Cartões de crédito</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCardForm({ name: '', credit_limit: 0, closing_day: 5, due_day: 12, payment_account_id: accounts[0]?.id || '', color: CATEGORY_COLORS[1] })}>
          <Plus size={18} /> Novo cartão
        </button>
      </div>
      {cards.length ? (
        <div className="stack stagger">
          {cards.map((c) => {
            const used = cardUsed(c, transactions)
            const cur = cardInvoices(c, transactions).find((i) => i.key === currentInvoiceKey(c))
            return (
              <button key={c.id} type="button" className="credit-card" style={{ '--cc': c.color }} onClick={() => openDetail(c)}>
                <div className="row-between">
                  <span className="strong">{c.name}</span>
                  <CreditCard size={22} aria-hidden="true" />
                </div>
                <div>
                  <span className="tiny">Fatura atual</span>
                  <span className="credit-card-value num">{brl(cur?.open || 0)}</span>
                </div>
                <div className="stack-sm" style={{ gap: 4 }}>
                  <ProgressBar ratio={c.credit_limit ? used / c.credit_limit : 0} label="Limite utilizado" height={6} />
                  <div className="credit-card-foot tiny">
                    <span>Disponível <strong className="num">{brl(Math.max(0, c.credit_limit - used))}</strong></span>
                    <span>Fecha dia {c.closing_day} · vence dia {c.due_day}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="card"><EmptyState title="Nenhum cartão" message="Cadastre cartões para controlar faturas e limite." /></div>
      )}

      {/* ---------- conta */}
      <Sheet open={Boolean(accForm)} onClose={() => setAccForm(null)} title={accForm?.id ? 'Editar conta' : 'Nova conta'}>
        {accForm && (
          <form className="stack" onSubmit={saveAccount}>
            <label className="field">
              <span>Nome</span>
              <input className="input" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} maxLength={40} data-autofocus />
            </label>
            <div className="segmented">
              {Object.entries(ACCOUNT_TYPES).map(([v, [l]]) => (
                <button key={v} type="button" aria-pressed={accForm.type === v} onClick={() => setAccForm({ ...accForm, type: v })}>{l}</button>
              ))}
            </div>
            <MoneyInput label="Saldo inicial" value={accForm.initial_balance} onChange={(v) => setAccForm({ ...accForm, initial_balance: v })} />
            <ColorPicker value={accForm.color} onChange={(color) => setAccForm({ ...accForm, color })} />
            <button className="btn btn-primary btn-block" disabled={busy}>Salvar</button>
            {accForm.id && (
              <button type="button" className="btn btn-danger btn-block" onClick={() => removeItem('accounts', accForm, 'conta')}>Excluir conta</button>
            )}
          </form>
        )}
      </Sheet>

      {/* ---------- cartão (form) */}
      <Sheet open={Boolean(cardForm)} onClose={() => setCardForm(null)} title={cardForm?.id ? 'Editar cartão' : 'Novo cartão'}>
        {cardForm && (
          <form className="stack" onSubmit={saveCard}>
            <label className="field">
              <span>Nome</span>
              <input className="input" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} maxLength={40} placeholder="Ex.: Nubank" data-autofocus />
            </label>
            <MoneyInput label="Limite" value={cardForm.credit_limit} onChange={(v) => setCardForm({ ...cardForm, credit_limit: v })} />
            <div className="grid-2">
              <label className="field">
                <span>Dia de fechamento</span>
                <input className="input" type="number" inputMode="numeric" min={1} max={31} value={cardForm.closing_day} onChange={(e) => setCardForm({ ...cardForm, closing_day: e.target.value })} />
              </label>
              <label className="field">
                <span>Dia de vencimento</span>
                <input className="input" type="number" inputMode="numeric" min={1} max={31} value={cardForm.due_day} onChange={(e) => setCardForm({ ...cardForm, due_day: e.target.value })} />
              </label>
            </div>
            <label className="field">
              <span>Conta que paga a fatura</span>
              <select className="select" value={cardForm.payment_account_id || ''} onChange={(e) => setCardForm({ ...cardForm, payment_account_id: e.target.value })}>
                <option value="">Escolher na hora</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <ColorPicker value={cardForm.color} onChange={(color) => setCardForm({ ...cardForm, color })} />
            <button className="btn btn-primary btn-block" disabled={busy}>Salvar</button>
            {cardForm.id && (
              <button type="button" className="btn btn-danger btn-block" onClick={() => removeItem('credit_cards', cardForm, 'cartão')}>Excluir cartão</button>
            )}
          </form>
        )}
      </Sheet>

      {/* ---------- cartão (faturas) */}
      <Sheet open={Boolean(card)} onClose={() => setDetail(null)} title={card?.name} size="full">
        {card && (
          <div className="stack">
            <div className="chips" role="group" aria-label="Faturas">
              {(invoices.length ? invoices : [{ key: currentInvoiceKey(card), status: 'open' }]).map((i) => (
                <button key={i.key} type="button" className="chip" aria-pressed={i.key === activeKey} onClick={() => setInvoiceKey(i.key)}>
                  {monthLabel(i.key, { short: true })} · {STATUS[i.status]}
                </button>
              ))}
            </div>

            <div className="card card--flat invoice-head">
              <div className="row-between">
                <span className="tiny muted strong">Fatura de {monthLabel(activeKey)}</span>
                {invoice && <span className={`badge ${invoice.status === 'paid' ? 'badge--income' : invoice.status === 'overdue' ? 'badge--expense' : 'badge--warning'}`}>{STATUS[invoice.status]}</span>}
              </div>
              <span className="total-value num">{brl(invoice?.open ?? 0)}</span>
              <span className="tiny muted">
                {invoice ? `Total ${brl(invoice.total)} · fecha ${formatDate(invoice.closing)} · vence ${formatDate(invoice.due)}` : 'Nenhuma compra nesta fatura ainda.'}
              </span>
              <span className="tiny muted">Limite disponível: {brl(Math.max(0, card.credit_limit - cardUsed(card, transactions)))}</span>
            </div>

            {invoice && invoice.open > 0 && (
              <div className="card card--flat stack-sm">
                <label className="field">
                  <span>Pagar com</span>
                  <select className="select" value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <button type="button" className="btn btn-primary btn-block" onClick={pay} disabled={!accounts.length}>
                  Pagar fatura de {brl(invoice.open)}
                </button>
              </div>
            )}

            {invoice?.items.length ? (
              <div className="list">
                {invoice.items.map((t) => (
                  <TransactionItem key={t.id} tx={t} onEdit={editor.editTx} onDelete={editor.deleteTx} />
                ))}
              </div>
            ) : null}

            <button type="button" className="btn btn-block" onClick={() => { setCardForm({ ...card, credit_limit: Number(card.credit_limit) }); setDetail(null) }}>
              Editar cartão
            </button>
          </div>
        )}
      </Sheet>
      {editor.sheet}
    </div>
  )
}
