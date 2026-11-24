import { useRef, useState } from 'react'
import { Check, CreditCard, Paperclip, Pencil, Repeat, Trash, User } from 'lucide-react'
import { CategoryBubble } from './CategoryIcon'
import Avatar from './Avatar'
import { brl } from '../lib/format'
import { formatDate } from '../lib/dates'
import { useLookups } from '../hooks/useLookups'
import { useHousehold } from '../context/HouseholdContext'
import './TransactionItem.css'

const ACTIONS_W = 136

/**
 * Lançamento com deslize para a esquerda (editar/excluir).
 * Os botões também são alcançáveis pelo teclado (Tab revela as ações).
 */
export default function TransactionItem({ tx, onEdit, onDelete, onTogglePaid, showDate = true }) {
  const { catById, accountById, cardById } = useLookups()
  const { memberById } = useHousehold()
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef({ x: 0, y: 0, base: 0, moved: false, axis: null })

  const category = catById.get(tx.category_id)
  const card = cardById.get(tx.card_id)
  const account = accountById.get(tx.account_id)
  const author = memberById.get(tx.user_id)
  const isIncome = tx.type === 'income'
  const isInvoicePayment = tx.kind === 'invoice_payment'
  const canToggle = onTogglePaid && !card && !isInvoicePayment
  const open = offset < -ACTIONS_W / 2

  const onPointerDown = (e) => {
    if (!onEdit && !onDelete) return
    g.current = { x: e.clientX, y: e.clientY, base: offset, moved: false, axis: null }
    setDragging(true)
  }
  const onPointerMove = (e) => {
    if (!dragging) return
    const dx = e.clientX - g.current.x
    const dy = e.clientY - g.current.y
    if (!g.current.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      g.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (g.current.axis === 'x') e.currentTarget.setPointerCapture?.(e.pointerId)
    }
    if (g.current.axis !== 'x') return
    g.current.moved = true
    setOffset(Math.max(-ACTIONS_W - 24, Math.min(0, g.current.base + dx)))
  }
  const onPointerUp = () => {
    if (!dragging) return
    setDragging(false)
    if (g.current.axis === 'x') setOffset((o) => (o < -ACTIONS_W / 2 ? -ACTIONS_W : 0))
  }

  const handleClick = () => {
    if (g.current.moved) {
      g.current.moved = false
      return
    }
    if (open) return setOffset(0)
    onEdit?.(tx)
  }

  const subtitle = [
    category?.name || (isInvoicePayment ? 'Pagamento de fatura' : 'Sem categoria'),
    card ? card.name : account?.name,
    showDate ? formatDate(tx.date) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={`tx-item ${dragging ? 'is-dragging' : ''}`}>
      {(onEdit || onDelete) && (
        <div className="tx-actions" style={{ width: ACTIONS_W }}>
          {onEdit && (
            <button type="button" className="tx-action tx-action--edit" onClick={() => { setOffset(0); onEdit(tx) }} onFocus={() => setOffset(-ACTIONS_W)} onBlur={() => setOffset(0)} aria-label={`Editar ${tx.description || 'lançamento'}`}>
              <Pencil size={18} />
              <span>Editar</span>
            </button>
          )}
          {onDelete && (
            <button type="button" className="tx-action tx-action--delete" onClick={() => { setOffset(0); onDelete(tx) }} onFocus={() => setOffset(-ACTIONS_W)} onBlur={() => setOffset(0)} aria-label={`Excluir ${tx.description || 'lançamento'}`}>
              <Trash size={18} />
              <span>Excluir</span>
            </button>
          )}
        </div>
      )}

      <div
        className="tx-content"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {canToggle ? (
          <button
            type="button"
            className={`tx-paid ${tx.paid ? 'is-paid' : ''}`}
            onClick={() => onTogglePaid(tx)}
            aria-pressed={tx.paid}
            aria-label={tx.paid ? `${isIncome ? 'Recebido' : 'Pago'} — marcar como pendente` : `Marcar como ${isIncome ? 'recebido' : 'pago'}`}
          >
            {tx.paid ? <Check size={18} strokeWidth={3} /> : <CategoryBubble category={category} size={38} />}
          </button>
        ) : (
          <CategoryBubble category={category || { icon: isInvoicePayment ? 'credit-card' : 'ellipsis' }} size={42} />
        )}

        <button type="button" className="tx-main" onClick={handleClick} tabIndex={onEdit ? 0 : -1}>
          <span className="tx-title ellipsis">
            {tx.description || category?.name || 'Lançamento'}
            {tx.installment_total && <span className="badge badge--brand tx-badge">{tx.installment_number}/{tx.installment_total}</span>}
          </span>
          <span className="tx-sub ellipsis">{subtitle}</span>
        </button>

        <div className="tx-right">
          <span className={`tx-amount num ${isIncome ? 't-income' : isInvoicePayment ? '' : 't-expense'}`}>
            {isIncome ? '+' : '−'} {brl(tx.amount)}
          </span>
          <span className="tx-meta">
            {tx.recurring_id && <Repeat size={13} aria-label="Recorrente" />}
            {card && <CreditCard size={13} aria-label="Cartão" />}
            {tx.receipt_path && <Paperclip size={13} aria-label="Com comprovante" />}
            {tx.shared === false && tx.type === 'expense' && <User size={13} aria-label="Gasto pessoal" />}
            {!tx.paid && !card && <span className="badge badge--warning">{isIncome ? 'a receber' : 'pendente'}</span>}
            {author && <Avatar id={author.user_id} name={author.profiles?.name} src={author.profiles?.avatar_url} size={20} title={`Lançado por ${author.profiles?.name}`} />}
          </span>
        </div>
      </div>
    </div>
  )
}
