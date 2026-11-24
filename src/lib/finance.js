// Regras de negócio puras (sem React): totais, saldos, faturas, metas.
import { addMonths, dateInMonth, monthKey, todayISO } from './dates'
import { numberToCents, sum } from './format'

export const isNormal = (t) => t.kind !== 'invoice_payment'

export function txInMonth(transactions, key) {
  return transactions.filter((t) => t.date.startsWith(key))
}

/** Ganhos e gastos (competência) — pagamento de fatura não conta como gasto. */
export function totals(txs) {
  const normal = txs.filter(isNormal)
  const income = sum(normal.filter((t) => t.type === 'income'), (t) => t.amount)
  const expense = sum(normal.filter((t) => t.type === 'expense'), (t) => t.amount)
  const pending = sum(normal.filter((t) => t.type === 'expense' && !t.paid), (t) => t.amount)
  return { income, expense, balance: (numberToCents(income) - numberToCents(expense)) / 100, pending }
}

export function byCategory(txs, categories, type = 'expense') {
  const map = new Map()
  for (const t of txs) {
    if (t.type !== type || !isNormal(t)) continue
    const key = t.category_id || 'none'
    map.set(key, (map.get(key) || 0) + numberToCents(t.amount))
  }
  const catById = new Map(categories.map((c) => [c.id, c]))
  return [...map.entries()]
    .map(([id, cents]) => {
      const c = catById.get(id)
      return {
        id,
        label: c?.name || 'Sem categoria',
        color: c?.color || '#8E8580',
        icon: c?.icon || 'ellipsis',
        value: cents / 100,
      }
    })
    .sort((a, b) => b.value - a.value)
}

// ---------------------------------------------------------------- contas
export function accountBalance(account, transactions) {
  let cents = numberToCents(account.initial_balance)
  for (const t of transactions) {
    if (t.account_id !== account.id || !t.paid) continue
    cents += (t.type === 'income' ? 1 : -1) * numberToCents(t.amount)
  }
  return cents / 100
}

// ---------------------------------------------------------------- cartões
/** Mês de fechamento (YYYY-MM) da fatura em que a compra cai. Igual ao SQL. */
export function invoiceMonthFor(dateISO, closingDay) {
  const key = monthKey(dateISO)
  const [y, m] = key.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const day = Number(dateISO.slice(8, 10))
  return day > Math.min(closingDay, lastDay) ? addMonths(key, 1) : key
}

export const invoiceMonthValue = (dateISO, card) =>
  card ? `${invoiceMonthFor(dateISO, card.closing_day)}-01` : null

/** Data de vencimento da fatura que fecha no mês `key`. */
export function invoiceDueDate(card, key) {
  const dueKey = card.due_day > card.closing_day ? key : addMonths(key, 1)
  return dateInMonth(dueKey, card.due_day)
}

export function invoiceClosingDate(card, key) {
  return dateInMonth(key, card.closing_day)
}

/** Faturas do cartão agrupadas por mês de fechamento, em ordem. */
export function cardInvoices(card, transactions) {
  const groups = new Map()
  for (const t of transactions) {
    if (t.card_id !== card.id || !isNormal(t) || t.type !== 'expense') continue
    const key = (t.invoice_month || invoiceMonthValue(t.date, card)).slice(0, 7)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(t)
  }
  const today = todayISO()
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, items]) => {
      const total = sum(items, (t) => t.amount)
      const open = sum(items.filter((t) => !t.paid), (t) => t.amount)
      const closing = invoiceClosingDate(card, key)
      const due = invoiceDueDate(card, key)
      let status = 'future'
      if (open === 0) status = 'paid'
      else if (today > due) status = 'overdue'
      else if (today > closing) status = 'closed'
      else if (key === invoiceMonthFor(today, card.closing_day)) status = 'open'
      return {
        key,
        items: items.sort((a, b) => b.date.localeCompare(a.date)),
        total,
        open,
        closing,
        due,
        status,
      }
    })
}

export function currentInvoiceKey(card) {
  return invoiceMonthFor(todayISO(), card.closing_day)
}

export function cardUsed(card, transactions) {
  return sum(
    transactions.filter((t) => t.card_id === card.id && isNormal(t) && t.type === 'expense' && !t.paid),
    (t) => t.amount,
  )
}

// ---------------------------------------------------------------- metas
export function budgetStatus(ratio) {
  if (ratio >= 1) return 'over'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

export function budgetProgress(budgets, categories, monthTxs) {
  const spent = new Map()
  for (const t of monthTxs) {
    if (t.type !== 'expense' || !isNormal(t) || !t.category_id) continue
    spent.set(t.category_id, (spent.get(t.category_id) || 0) + numberToCents(t.amount))
  }
  const catById = new Map(categories.map((c) => [c.id, c]))
  return budgets
    .filter((b) => catById.has(b.category_id))
    .map((b) => {
      const value = (spent.get(b.category_id) || 0) / 100
      const ratio = b.monthly_limit > 0 ? value / Number(b.monthly_limit) : 0
      return { ...b, category: catById.get(b.category_id), spent: value, ratio, status: budgetStatus(ratio) }
    })
    .sort((a, b) => b.ratio - a.ratio)
}

/** Divide um total em N parcelas exatas em centavos (a 1ª absorve o resto). */
export function splitInstallments(total, n) {
  const cents = numberToCents(total)
  const base = Math.floor(cents / n)
  const rest = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? rest : 0)) / 100)
}

export function percentChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}
