import { createContext, useContext, useMemo, useState } from 'react'
import { addMonths, currentMonth } from '../lib/dates'

const MonthContext = createContext(null)

/** Mês selecionado, compartilhado entre Dashboard, Ganhos, Gastos e Controle. */
export function MonthProvider({ children }) {
  const [month, setMonth] = useState(currentMonth)
  const value = useMemo(
    () => ({
      month,
      setMonth,
      prev: () => setMonth((m) => addMonths(m, -1)),
      next: () => setMonth((m) => addMonths(m, 1)),
      reset: () => setMonth(currentMonth()),
    }),
    [month],
  )
  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
}

export const useMonthContext = () => useContext(MonthContext)
