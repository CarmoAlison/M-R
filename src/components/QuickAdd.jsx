import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronDown, CircleArrowDown, CircleArrowUp, CreditCard, Landmark, Paperclip, X } from 'lucide-react'
import Sheet from './Sheet'
import AmountPad from './AmountPad'
import CategoryIcon from './CategoryIcon'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useToast } from '../context/ToastContext'
import { useFinanceActions } from '../hooks/useFinanceActions'
import { useLookups } from '../hooks/useLookups'
import { addDays, formatDate, monthLabel, todayISO } from '../lib/dates'
import { brl } from '../lib/format'
import { invoiceMonthFor, splitInstallments } from '../lib/finance'
import { uploadReceipt } from '../lib/receipts'
import './QuickAdd.css'

const fresh = (type, accountId) => ({
  type,
  cents: 0,
  description: '',
  category_id: '',
  source: accountId ? `acc:${accountId}` : '',
  date: todayISO(),
  paid: true,
  recurring: false,
  installments: 1,
  shared: true,
  paid_by: null,
  file: null,
})

/** Lançamento rápido: teclado de calculadora + escolhas em chips. */
export default function QuickAdd({ open, onClose, initialType = 'expense' }) {
  const { accounts, cards, transactions } = useData()
  const { user } = useAuth()
  const { members, householdId } = useHousehold()
  const data = useData()
  const { activeCategories, cardById } = useLookups()
  const { createTransaction } = useFinanceActions()
  const toast = useToast()
  const fileRef = useRef(null)
  const dateRef = useRef(null)
  const [f, setF] = useState(() => fresh(initialType, accounts[0]?.id))
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const set = (patch) => setF((s) => ({ ...s, ...patch }))
  const isExpense = f.type === 'expense'

  // reinicia ao abrir
  useEffect(() => {
    if (open) {
      setF(fresh(initialType, accounts[0]?.id))
      setMore(false)
    }
  }, [open, initialType]) // eslint-disable-line react-hooks/exhaustive-deps

  // categorias mais usadas primeiro
  const cats = useMemo(() => {
    const usage = new Map()
    for (const t of transactions.slice(0, 300)) if (t.category_id) usage.set(t.category_id, (usage.get(t.category_id) || 0) + 1)
    return [...activeCategories(f.type)].sort((a, b) => (usage.get(b.id) || 0) - (usage.get(a.id) || 0))
  }, [activeCategories, f.type, transactions])

  const [kind, sourceId] = (f.source || '').split(':')
  const card = kind === 'card' ? cardById.get(sourceId) : null
  const amount = f.cents / 100
  const today = todayISO()
  const yesterday = addDays(today, -1)

  const save = async () => {
    if (!f.cents) return toast.error('Digite o valor.')
    if (!f.source && accounts.length) return toast.error('Escolha a conta.')
    setBusy(true)
    try {
      const { rows, alerts } = await createTransaction({
        type: f.type,
        amount,
        description: f.description,
        category_id: f.category_id || cats.find((c) => c.name.toLowerCase() === 'outros')?.id || cats[0]?.id || null,
        account_id: kind === 'acc' ? sourceId : null,
        card_id: isExpense && kind === 'card' ? sourceId : null,
        date: f.date,
        paid: f.paid,
        recurring: f.recurring,
        installments: isExpense ? f.installments : 1,
        paid_by: isExpense ? f.paid_by || user.id : undefined,
        shared: isExpense ? f.shared : undefined,
      })
      if (f.file) {
        try {
          const path = await uploadReceipt(householdId, rows[0].id, f.file)
          await data.update('transactions', rows[0].id, { receipt_path: path })
        } catch (err) {
          toast.error(`Lançado, mas o comprovante não subiu: ${err.message}`)
        }
      }
      toast.success(rows.length > 1 ? `${rows.length} parcelas lançadas` : isExpense ? 'Gasto lançado' : 'Ganho lançado')
      alerts.forEach((a) => toast.info(a))
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const parts = f.installments > 1 && amount > 0 ? splitInstallments(amount, f.installments) : null

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Novo lançamento"
      footer={
        <button type="button" className="btn btn-primary btn-block qa-save" onClick={save} disabled={busy || !f.cents}>
          {busy ? <span className="spinner" aria-label="Salvando" /> : `Salvar ${isExpense ? 'gasto' : 'ganho'}${f.cents ? ` de ${brl(amount)}` : ''}`}
        </button>
      }
    >
      <div className="qa">
        <div className="segmented" role="group" aria-label="Tipo de lançamento">
          <button type="button" aria-pressed={isExpense} onClick={() => set({ type: 'expense', category_id: '' })}>
            <CircleArrowDown size={18} /> Gasto
          </button>
          <button type="button" aria-pressed={!isExpense} onClick={() => set({ type: 'income', category_id: '', installments: 1, source: f.source.startsWith('card') ? `acc:${accounts[0]?.id || ''}` : f.source })}>
            <CircleArrowUp size={18} /> Ganho
          </button>
        </div>

        <output className={`qa-amount display-num ${isExpense ? 't-expense' : 't-income'}`} aria-live="polite">
          {brl(amount)}
          {parts && <span className="qa-parts">{f.installments}× de {brl(parts[parts.length - 1])}</span>}
        </output>

        <input
          className="input qa-desc"
          placeholder={isExpense ? 'Descrição (opcional) — ex.: feira' : 'Descrição (opcional) — ex.: salário'}
          value={f.description}
          onChange={(e) => set({ description: e.target.value })}
          maxLength={80}
          aria-label="Descrição"
        />

        <div className="qa-chips" role="radiogroup" aria-label="Categoria">
          {cats.map((c) => {
            const active = f.category_id === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                className="qa-chip"
                style={active ? { background: c.color, borderColor: c.color, color: 'var(--on-color)' } : { color: c.color }}
                onClick={() => set({ category_id: active ? '' : c.id })}
              >
                <CategoryIcon name={c.icon} size={16} />
                <span>{c.name}</span>
              </button>
            )
          })}
        </div>

        <div className="qa-chips" role="radiogroup" aria-label={isExpense ? 'Pagar com' : 'Receber em'}>
          {accounts.map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={f.source === `acc:${a.id}`} className="qa-chip qa-chip--plain" onClick={() => set({ source: `acc:${a.id}` })}>
              <Landmark size={15} /> <span>{a.name}</span>
            </button>
          ))}
          {isExpense &&
            cards.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={f.source === `card:${c.id}`} className="qa-chip qa-chip--plain" onClick={() => set({ source: `card:${c.id}`, paid: false })}>
                <CreditCard size={15} /> <span>{c.name}</span>
              </button>
            ))}
          {!accounts.length && (
            <Link to="/contas" className="qa-chip qa-chip--plain" onClick={onClose}>+ Criar conta</Link>
          )}
        </div>

        <div className="qa-chips" role="radiogroup" aria-label="Data">
          <button type="button" role="radio" aria-checked={f.date === today} className="qa-chip qa-chip--plain" onClick={() => set({ date: today })}>Hoje</button>
          <button type="button" role="radio" aria-checked={f.date === yesterday} className="qa-chip qa-chip--plain" onClick={() => set({ date: yesterday })}>Ontem</button>
          <label className={`qa-chip qa-chip--plain qa-date ${f.date !== today && f.date !== yesterday ? 'is-active' : ''}`}>
            <CalendarDays size={15} />
            <span>{f.date !== today && f.date !== yesterday ? formatDate(f.date, { day: '2-digit', month: 'short' }) : 'Outra data'}</span>
            <input ref={dateRef} type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} aria-label="Escolher data" />
          </label>
        </div>

        {card && <p className="tiny muted qa-hint">Entra na fatura de {monthLabel(invoiceMonthFor(f.date, card.closing_day))}.</p>}

        <button type="button" className="qa-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          Mais opções <ChevronDown size={16} style={{ transform: more ? 'rotate(180deg)' : 'none' }} />
        </button>

        {more && (
          <div className="qa-options fade-in">
            {!card && (
              <label className="switch">
                <span>{isExpense ? 'Já está pago' : 'Já recebi'}</span>
                <input type="checkbox" checked={f.paid} onChange={(e) => set({ paid: e.target.checked })} />
                <span className="switch-track" aria-hidden="true" />
              </label>
            )}
            <label className="switch">
              <span>Repetir todo mês</span>
              <input type="checkbox" checked={f.recurring} onChange={(e) => set({ recurring: e.target.checked, installments: 1 })} />
              <span className="switch-track" aria-hidden="true" />
            </label>
            {isExpense && (
              <label className="field">
                <span>Parcelas</span>
                <select className="select" value={f.installments} onChange={(e) => set({ installments: Number(e.target.value), recurring: false })}>
                  <option value={1}>À vista</option>
                  {Array.from({ length: 47 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>{n}× {amount > 0 ? `de ${brl(splitInstallments(amount, n)[n - 1])}` : ''}</option>
                  ))}
                </select>
              </label>
            )}
            {isExpense && members.length > 1 && (
              <>
                <label className="field">
                  <span>Pago por</span>
                  <select className="select" value={f.paid_by || user?.id} onChange={(e) => set({ paid_by: e.target.value })}>
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>{m.user_id === user?.id ? 'Eu' : m.profiles?.name || 'Membro'}</option>
                    ))}
                  </select>
                </label>
                <label className="switch">
                  <span>Dividir com a casa</span>
                  <input type="checkbox" checked={f.shared} onChange={(e) => set({ shared: e.target.checked })} />
                  <span className="switch-track" aria-hidden="true" />
                </label>
              </>
            )}
            {f.file ? (
              <div className="row-between qa-file">
                <span className="small ellipsis"><Paperclip size={14} /> {f.file.name}</span>
                <button type="button" className="icon-btn" onClick={() => set({ file: null })} aria-label="Remover comprovante"><X size={18} /></button>
              </div>
            ) : (
              <button type="button" className="btn btn-sm btn-block" onClick={() => fileRef.current?.click()}>
                <Paperclip size={16} /> Anexar comprovante
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) set({ file })
              }}
            />
          </div>
        )}

        <AmountPad cents={f.cents} onChange={(cents) => set({ cents })} />
      </div>
    </Sheet>
  )
}
