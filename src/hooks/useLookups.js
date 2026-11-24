import { useMemo } from 'react'
import { useData } from '../context/DataContext'

/** Mapas id -> registro para exibir lançamentos rapidamente. */
export function useLookups() {
  const { categories, accounts, cards } = useData()
  return useMemo(
    () => ({
      catById: new Map(categories.map((c) => [c.id, c])),
      accountById: new Map(accounts.map((a) => [a.id, a])),
      cardById: new Map(cards.map((c) => [c.id, c])),
      activeCategories: (type) => categories.filter((c) => c.type === type && !c.archived),
    }),
    [categories, accounts, cards],
  )
}
