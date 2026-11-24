// Operações de domínio de alto nível sobre o DataContext.
import { useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useHousehold } from '../context/HouseholdContext'
import { addDays, addMonths, addMonthsToDate, currentMonth, dateInMonth, monthKey, monthLabel, todayISO } from '../lib/dates'
import { budgetProgress, invoiceMonthValue, splitInstallments, txInMonth } from '../lib/finance'
import { uuid } from '../lib/format'

const EDITABLE = ['amount', 'description', 'category_id', 'account_id', 'card_id']
// campos que só existem no lançamento (não na regra recorrente)
const TX_EDITABLE = [...EDITABLE, 'paid_by', 'shared']
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]))

export function useFinanceActions() {
  const data = useData()
  const { user } = useAuth()
  const { householdId } = useHousehold()
  const { transactions, cards, budgets, categories } = data

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])

  /** Retorna alertas de meta (80%/100%) cruzados por um novo gasto. */
  const budgetAlerts = useCallback(
    (newTx) => {
      const alerts = []
      const byMonth = new Map()
      for (const t of newTx) {
        if (t.type !== 'expense') continue
        const k = monthKey(t.date)
        if (!byMonth.has(k)) byMonth.set(k, [])
        byMonth.get(k).push(t)
      }
      for (const [k, list] of byMonth) {
        if (k !== currentMonth()) continue
        const before = budgetProgress(budgets, categories, txInMonth(transactions, k))
        const after = budgetProgress(budgets, categories, [...txInMonth(transactions, k), ...list])
        for (const a of after) {
          const b = before.find((x) => x.id === a.id)
          if (a.status !== 'ok' && a.status !== b?.status) {
            alerts.push(
              a.status === 'over'
                ? `${a.category.name} ultrapassou a meta do mês 😬`
                : `${a.category.name} chegou a ${Math.round(a.ratio * 100)}% da meta`,
            )
          }
        }
      }
      return alerts
    },
    [budgets, categories, transactions],
  )

  /** form: { type, amount, description, category_id, account_id, card_id, date, paid, recurring, installments } */
  const createTransaction = useCallback(
    async (form) => {
      const card = form.card_id ? cardById.get(form.card_id) : null
      const base = {
        type: form.type,
        kind: 'normal',
        description: form.description.trim(),
        category_id: form.category_id || null,
        account_id: card ? null : form.account_id || null,
        card_id: card?.id ?? null,
        user_id: user.id,
        paid_by: form.paid_by || user.id,
        shared: form.shared !== false,
      }
      let rows

      if (form.type === 'expense' && form.installments > 1) {
        const group = uuid()
        rows = splitInstallments(form.amount, form.installments).map((amount, i) => {
          const date = addMonthsToDate(form.date, i)
          return {
            ...base,
            id: uuid(),
            amount,
            date,
            paid: card ? false : i === 0 ? form.paid : false,
            installment_group_id: group,
            installment_number: i + 1,
            installment_total: form.installments,
            invoice_month: invoiceMonthValue(date, card),
          }
        })
        await data.insert('transactions', rows)
      } else if (form.recurring) {
        const ruleId = uuid()
        await data.insert('recurring_rules', {
          id: ruleId,
          created_by: user.id,
          type: form.type,
          amount: form.amount,
          description: base.description,
          category_id: base.category_id,
          account_id: base.account_id,
          card_id: base.card_id,
          day_of_month: Number(form.date.slice(8, 10)),
          active: true,
          start_date: form.date,
          last_generated: `${monthKey(form.date)}-01`,
        })
        rows = [{ ...base, id: uuid(), amount: form.amount, date: form.date, paid: card ? false : form.paid, recurring_id: ruleId, invoice_month: invoiceMonthValue(form.date, card) }]
        await data.insert('transactions', rows)
        await data.rpc('generate_recurring', { p_household: householdId }, { refetchTables: ['transactions', 'recurring_rules'] })
      } else {
        rows = [{ ...base, id: uuid(), amount: form.amount, date: form.date, paid: card ? false : form.paid, invoice_month: invoiceMonthValue(form.date, card) }]
        await data.insert('transactions', rows)
      }
      return { rows, alerts: budgetAlerts(rows) }
    },
    [cardById, data, user, householdId, budgetAlerts],
  )

  /** scope: 'one' | 'future' */
  const updateTransaction = useCallback(
    async (tx, form, scope = 'one') => {
      const card = form.card_id ? cardById.get(form.card_id) : null
      const patch = {
        amount: form.amount,
        description: form.description.trim(),
        category_id: form.category_id || null,
        account_id: card ? null : form.account_id || null,
        card_id: card?.id ?? null,
        date: form.date,
        paid: card ? tx.paid && tx.card_id === card.id : form.paid,
        invoice_month: invoiceMonthValue(form.date, card),
      }
      if (form.paid_by) patch.paid_by = form.paid_by
      if (typeof form.shared === 'boolean') patch.shared = form.shared
      await data.update('transactions', tx.id, patch)
      if (scope !== 'future') return

      const shared = pick(patch, TX_EDITABLE)
      const ruleFields = pick(patch, EDITABLE)
      if (tx.installment_group_id) {
        const ids = transactions
          .filter((t) => t.installment_group_id === tx.installment_group_id && t.installment_number > tx.installment_number)
          .map((t) => t.id)
        if (ids.length) await data.update('transactions', ids, shared)
      } else if (tx.recurring_id) {
        const ids = transactions.filter((t) => t.recurring_id === tx.recurring_id && t.date > tx.date && !t.paid).map((t) => t.id)
        if (ids.length) await data.update('transactions', ids, shared)
        await data.update('recurring_rules', tx.recurring_id, { ...ruleFields, day_of_month: Number(form.date.slice(8, 10)) })
      }
      // o gatilho do banco recalcula a fatura de cada item; recarrega para refletir
      data.refetch('transactions').catch(() => {})
    },
    [cardById, data, transactions],
  )

  const deleteTransaction = useCallback(
    async (tx, scope = 'one') => {
      if (scope !== 'future') return data.remove('transactions', tx.id)
      if (tx.installment_group_id) {
        const ids = transactions
          .filter((t) => t.installment_group_id === tx.installment_group_id && t.installment_number >= tx.installment_number)
          .map((t) => t.id)
        return data.remove('transactions', ids)
      }
      if (tx.recurring_id) {
        const ids = transactions
          .filter((t) => t.recurring_id === tx.recurring_id && (t.id === tx.id || (t.date > tx.date && !t.paid)))
          .map((t) => t.id)
        await data.update('recurring_rules', tx.recurring_id, { end_date: addDays(tx.date, -1) })
        return data.remove('transactions', ids)
      }
      return data.remove('transactions', tx.id)
    },
    [data, transactions],
  )

  const togglePaid = useCallback((tx) => data.update('transactions', tx.id, { paid: !tx.paid }), [data])

  const payInvoice = useCallback(
    async (card, invoice, accountId, date = todayISO()) => {
      const unpaid = invoice.items.filter((t) => !t.paid)
      if (!unpaid.length) return
      await data.insert('transactions', {
        id: uuid(),
        type: 'expense',
        kind: 'invoice_payment',
        amount: invoice.open,
        description: `Fatura ${card.name} · ${monthLabel(invoice.key, { short: true })}`,
        date,
        account_id: accountId,
        card_id: card.id,
        category_id: null,
        paid: true,
        invoice_month: `${invoice.key}-01`,
        user_id: user.id,
      })
      await data.update('transactions', unpaid.map((t) => t.id), { paid: true })
    },
    [data, user],
  )

  // ------------------------------------------------------------ recorrentes
  const pauseRule = useCallback((rule) => data.update('recurring_rules', rule.id, { active: false }), [data])

  const resumeRule = useCallback(
    async (rule) => {
      const prev = `${addMonths(currentMonth(), -1)}-01`
      const patch = { active: true }
      if (!rule.last_generated || rule.last_generated < prev) patch.last_generated = prev
      await data.update('recurring_rules', rule.id, patch)
      await data.rpc('generate_recurring', { p_household: householdId }, { refetchTables: ['transactions', 'recurring_rules'] })
    },
    [data, householdId],
  )

  const endRule = useCallback(
    async (rule) => {
      const today = todayISO()
      await data.update('recurring_rules', rule.id, { end_date: today, active: false })
      const ids = transactions.filter((t) => t.recurring_id === rule.id && t.date > today && !t.paid).map((t) => t.id)
      if (ids.length) await data.remove('transactions', ids)
    },
    [data, transactions],
  )

  const editRule = useCallback(
    async (rule, patch) => {
      await data.update('recurring_rules', rule.id, patch)
      const today = todayISO()
      const future = transactions.filter((t) => t.recurring_id === rule.id && t.date >= today && !t.paid)
      const shared = pick(patch, EDITABLE)
      if (patch.day_of_month && patch.day_of_month !== rule.day_of_month) {
        for (const t of future) {
          await data.update('transactions', t.id, { ...shared, date: dateInMonth(monthKey(t.date), patch.day_of_month) })
        }
      } else if (future.length && Object.keys(shared).length) {
        await data.update('transactions', future.map((t) => t.id), shared)
      }
      if (patch.end_date) {
        const ids = future.filter((t) => t.date > patch.end_date).map((t) => t.id)
        if (ids.length) await data.remove('transactions', ids)
      }
    },
    [data, transactions],
  )

  const endInstallments = useCallback(
    async (groupId) => {
      const today = todayISO()
      const ids = transactions.filter((t) => t.installment_group_id === groupId && !t.paid && t.date > today).map((t) => t.id)
      if (ids.length) await data.remove('transactions', ids)
      return ids.length
    },
    [data, transactions],
  )

  // ------------------------------------------------------------ metas
  const setBudget = useCallback(
    async (categoryId, limit) => {
      const existing = budgets.find((b) => b.category_id === categoryId)
      if (!limit) return existing ? data.remove('budgets', existing.id) : undefined
      if (existing) return data.update('budgets', existing.id, { monthly_limit: limit })
      return data.insert('budgets', { id: uuid(), category_id: categoryId, monthly_limit: limit })
    },
    [budgets, data],
  )

  return {
    createTransaction,
    updateTransaction,
    deleteTransaction,
    togglePaid,
    payInvoice,
    pauseRule,
    resumeRule,
    endRule,
    editRule,
    endInstallments,
    setBudget,
  }
}
