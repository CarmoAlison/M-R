// Armazém de dados da casa: carrega tudo, mantém cache offline,
// aplica mudanças otimistas, enfileira quando offline e escuta o Realtime.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { enqueue, flushQueue, onQueueChange, readQueue, runOp } from '../lib/offlineQueue'
import { friendlyError, isNetworkError } from '../lib/errors'
import { useHousehold } from './HouseholdContext'
import { useToast } from './ToastContext'

export const DataContext = createContext(null)
export const TABLES = [
  'transactions', 'accounts', 'credit_cards', 'categories', 'budgets', 'recurring_rules',
  'goals', 'goal_entries', 'settlements',
]
const OPTIONAL_TABLES = new Set(['goals', 'goal_entries', 'settlements'])
const EMPTY = Object.fromEntries(TABLES.map((t) => [t, []]))
const cacheKey = (hid) => `cf-cache-${hid}`

function readCache(hid) {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(cacheKey(hid))) }
  } catch {
    return null
  }
}

async function fetchTable(table, hid) {
  const pageSize = 1000
  let from = 0
  const all = []
  for (;;) {
    let q = supabase.from(table).select('*').eq('household_id', hid)
    q = table === 'transactions' ? q.order('date', { ascending: false }).order('created_at', { ascending: false }) : q.order('created_at')
    const { data, error } = await q.range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

function applyLocal(state, op) {
  const list = state[op.table]
  if (!list) return state
  let next = list
  if (op.op === 'insert' || op.op === 'upsert') {
    const ids = new Set(op.rows.map((r) => r.id))
    next = [...list.filter((r) => !ids.has(r.id)), ...op.rows.map((r) => ({ created_at: new Date().toISOString(), ...r }))]
  } else if (op.op === 'update') {
    const ids = new Set(op.ids)
    next = list.map((r) => (ids.has(r.id) ? { ...r, ...op.patch } : r))
  } else if (op.op === 'delete') {
    const ids = new Set(op.ids)
    next = list.filter((r) => !ids.has(r.id))
  }
  return { ...state, [op.table]: next }
}

const sortTx = (a, b) => b.date.localeCompare(a.date) || String(b.created_at).localeCompare(String(a.created_at))

export function DataProvider({ children }) {
  const { householdId } = useHousehold()
  const toast = useToast()
  const [state, setState] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(readQueue().length)
  const timers = useRef({})
  const hidRef = useRef(householdId)
  hidRef.current = householdId

  const refetch = useCallback(async (table) => {
    const hid = hidRef.current
    if (!hid) return
    const rows = await fetchTable(table, hid)
    if (hidRef.current === hid) setState((s) => ({ ...s, [table]: rows }))
  }, [])

  const loadAll = useCallback(async () => {
    const hid = hidRef.current
    if (!hid || !navigator.onLine) return
    // gera lançamentos fixos pendentes antes de carregar
    await supabase.rpc('generate_recurring', { p_household: hid }).then(() => {}, () => {})
    const entries = await Promise.all(
      TABLES.map(async (t) => {
        try {
          return [t, await fetchTable(t, hid)]
        } catch (e) {
          // tabelas das funções novas: se a migration ainda não rodou, segue sem elas
          if (OPTIONAL_TABLES.has(t) && !isNetworkError(e)) {
            console.warn(`[dados] tabela ${t} indisponível — rode as migrations mais recentes.`, e.message)
            return [t, []]
          }
          throw e
        }
      }),
    )
    if (hidRef.current === hid) setState(Object.fromEntries(entries))
  }, [])

  // troca de casa: hidrata do cache e busca do servidor
  useEffect(() => {
    if (!householdId) {
      setState(EMPTY)
      setLoading(false)
      return
    }
    const cached = readCache(householdId)
    setState(cached || EMPTY)
    setLoading(!cached)
    flushQueue({ onError: (e) => toast.error(friendlyError(e)) })
      .then(loadAll)
      .catch((e) => {
        if (!isNetworkError(e)) toast.error(friendlyError(e))
      })
      .finally(() => setLoading(false))
  }, [householdId, loadAll, toast])

  // cache para leitura offline
  useEffect(() => {
    if (!householdId || loading) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(cacheKey(householdId), JSON.stringify(state))
      } catch {
        /* cota cheia */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [state, householdId, loading])

  // online/offline + sincronização da fila
  useEffect(() => {
    const goOnline = async () => {
      setOnline(true)
      const n = await flushQueue({ onError: (e) => toast.error(friendlyError(e)) })
      if (n) toast.success(`${n} ${n === 1 ? 'alteração sincronizada' : 'alterações sincronizadas'}`)
      loadAll().catch(() => {})
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const off = onQueueChange(setPending)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      off()
    }
  }, [loadAll, toast])

  // Realtime: qualquer mudança feita por outro membro recarrega a tabela
  useEffect(() => {
    if (!householdId) return
    const channel = supabase.channel(`household-${householdId}`)
    for (const table of TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, () => {
        clearTimeout(timers.current[table])
        timers.current[table] = setTimeout(() => refetch(table).catch(() => {}), 350)
      })
    }
    channel.subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, refetch])

  /** Aplica a operação localmente e envia (ou enfileira se offline). */
  const mutate = useCallback(
    async (op) => {
      setState((s) => applyLocal(s, op))
      if (!navigator.onLine) {
        enqueue(op)
        return { queued: true }
      }
      try {
        await runOp(op)
        return { queued: false }
      } catch (err) {
        if (isNetworkError(err)) {
          enqueue(op)
          return { queued: true }
        }
        refetch(op.table).catch(() => {}) // desfaz o otimista
        throw new Error(friendlyError(err), { cause: err })
      }
    },
    [refetch],
  )

  const api = useMemo(() => {
    const withHousehold = (rows) => rows.map((r) => ({ household_id: hidRef.current, ...r }))
    return {
      insert: (table, rows) => mutate({ op: 'insert', table, rows: withHousehold([].concat(rows)) }),
      upsert: (table, rows, options) => mutate({ op: 'upsert', table, rows: withHousehold([].concat(rows)), options }),
      update: (table, ids, patch) => mutate({ op: 'update', table, ids: [].concat(ids), patch }),
      remove: (table, ids) => mutate({ op: 'delete', table, ids: [].concat(ids) }),
      rpc: async (fn, args, { refetchTables = [] } = {}) => {
        const op = { op: 'rpc', fn, args }
        if (!navigator.onLine) {
          enqueue(op)
          return { queued: true }
        }
        try {
          const data = await runOp(op)
          await Promise.all(refetchTables.map((t) => refetch(t)))
          return { data }
        } catch (err) {
          if (isNetworkError(err)) {
            enqueue(op)
            return { queued: true }
          }
          throw new Error(friendlyError(err), { cause: err })
        }
      },
      refetch,
      reload: loadAll,
    }
  }, [mutate, refetch, loadAll])

  const value = useMemo(
    () => ({
      ...api,
      loading,
      online,
      pending,
      transactions: [...state.transactions].sort(sortTx),
      accounts: state.accounts,
      cards: state.credit_cards,
      categories: state.categories,
      budgets: state.budgets,
      rules: state.recurring_rules,
      goals: state.goals,
      goalEntries: state.goal_entries,
      settlements: state.settlements,
    }),
    [api, loading, online, pending, state],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export const useData = () => useContext(DataContext)
