import { createContext, useContext } from 'react'

/** open('expense' | 'income') abre o lançamento rápido de qualquer tela. */
export const QuickAddContext = createContext({ open: () => {} })
export const useQuickAdd = () => useContext(QuickAddContext)
