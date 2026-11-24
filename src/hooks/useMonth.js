import { useMemo } from 'react'
import { useMonthContext } from '../context/MonthContext'
import { useData } from '../context/DataContext'
import { addMonths } from '../lib/dates'
import { totals, txInMonth } from '../lib/finance'

/** Mês selecionado + lançamentos e totais do mês e do anterior. */
export function useMonth() {
  const ctx = useMonthContext()
  const { transactions } = useData()
  return useMemo(() => {
    const monthTx = txInMonth(transactions, ctx.month)
    const prevTx = txInMonth(transactions, addMonths(ctx.month, -1))
    return { ...ctx, monthTx, prevTx, totals: totals(monthTx), prevTotals: totals(prevTx) }
  }, [ctx, transactions])
}
