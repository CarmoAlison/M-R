// Divisão de gastos compartilhados entre os membros da casa (partes iguais).
import { isNormal } from './finance'
import { numberToCents } from './format'

export const payerOf = (t) => t.paid_by || t.user_id

/**
 * Saldo de cada membro: pagou − sua parte (+ acertos).
 * Positivo = tem a receber; negativo = deve.
 */
export function splitBalances(transactions, settlements, memberIds) {
  const n = memberIds.length || 1
  const paid = new Map(memberIds.map((id) => [id, 0]))
  const share = new Map(memberIds.map((id) => [id, 0]))

  for (const t of transactions) {
    if (t.type !== 'expense' || !isNormal(t) || t.shared === false) continue
    const cents = numberToCents(t.amount)
    const payer = payerOf(t)
    if (!paid.has(payer)) continue // ex-membro: fora da divisão atual
    paid.set(payer, paid.get(payer) + cents)
    for (const id of memberIds) share.set(id, share.get(id) + cents / n)
  }
  // acerto: "from" pagou "to" → from deve menos, to tem menos a receber
  for (const s of settlements) {
    const cents = numberToCents(s.amount)
    if (paid.has(s.from_user)) paid.set(s.from_user, paid.get(s.from_user) + cents)
    if (paid.has(s.to_user)) paid.set(s.to_user, paid.get(s.to_user) - cents)
  }
  return memberIds.map((id) => ({
    user_id: id,
    paid: Math.round(paid.get(id)) / 100,
    share: Math.round(share.get(id)) / 100,
    balance: Math.round(paid.get(id) - share.get(id)) / 100,
  }))
}

/** Menor lista de transferências para zerar os saldos (guloso). */
export function settleUp(balances) {
  const debtors = balances.filter((b) => b.balance < -0.004).map((b) => ({ ...b, left: -b.balance }))
  const creditors = balances.filter((b) => b.balance > 0.004).map((b) => ({ ...b, left: b.balance }))
  debtors.sort((a, b) => b.left - a.left)
  creditors.sort((a, b) => b.left - a.left)
  const out = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left)
    if (amount >= 0.01) out.push({ from: debtors[i].user_id, to: creditors[j].user_id, amount: Math.round(amount * 100) / 100 })
    debtors[i].left -= amount
    creditors[j].left -= amount
    if (debtors[i].left < 0.01) i++
    if (creditors[j].left < 0.01) j++
  }
  return out
}
