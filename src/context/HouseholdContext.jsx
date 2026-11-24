import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthContext'

export const HouseholdContext = createContext(null)
const MEMBERSHIPS = 'cf-memberships'
const CURRENT = 'cf-household'

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(MEMBERSHIPS)) || null
  } catch {
    return null
  }
}

export function HouseholdProvider({ children }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [memberships, setMemberships] = useState([])
  const [members, setMembers] = useState([])
  const [currentId, setCurrentId] = useState(() => localStorage.getItem(CURRENT))
  // id do usuário cujas casas já foram carregadas (cache ou rede)
  const [loadedFor, setLoadedFor] = useState(null)
  const loading = Boolean(userId) && loadedFor !== userId

  const loadMemberships = useCallback(async () => {
    if (!userId) return []
    const { data, error } = await supabase
      .from('household_members')
      .select('household_id, role, households(id, name, created_by)')
      .eq('user_id', userId)
    if (error) throw error
    const list = data || []
    setMemberships(list)
    localStorage.setItem(MEMBERSHIPS, JSON.stringify({ userId, list }))
    return list
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setMemberships([])
      setLoadedFor(null)
      return
    }
    const c = readCache()
    if (c?.userId === userId && c.list) {
      setMemberships(c.list)
      setLoadedFor(userId)
    }
    loadMemberships()
      .catch(() => {}) // offline: usa o cache
      .finally(() => setLoadedFor(userId))
  }, [userId, loadMemberships])

  const current = useMemo(() => {
    if (!memberships.length) return null
    return memberships.find((m) => m.household_id === currentId) || memberships[0]
  }, [memberships, currentId])

  const householdId = current?.household_id ?? null

  const loadMembers = useCallback(async () => {
    if (!householdId) return
    const { data } = await supabase
      .from('household_members')
      .select('user_id, role, joined_at, profiles(id, name, avatar_url)')
      .eq('household_id', householdId)
      .order('joined_at')
    if (data) {
      setMembers(data)
      localStorage.setItem(`cf-members-${householdId}`, JSON.stringify(data))
    }
  }, [householdId])

  useEffect(() => {
    if (!householdId) return setMembers([])
    try {
      setMembers(JSON.parse(localStorage.getItem(`cf-members-${householdId}`)) || [])
    } catch {
      /* ignore */
    }
    loadMembers().catch(() => {})
  }, [householdId, loadMembers])

  // novos membros / saídas aparecem em tempo real
  useEffect(() => {
    if (!householdId) return
    const ch = supabase
      .channel(`members-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, () =>
        loadMembers().catch(() => {}),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [householdId, loadMembers])

  const switchHousehold = useCallback((id) => {
    localStorage.setItem(CURRENT, id)
    setCurrentId(id)
  }, [])

  const createHousehold = useCallback(
    async (name) => {
      const { data, error } = await supabase.rpc('create_household', { p_name: name })
      if (error) throw error
      await loadMemberships()
      switchHousehold(data)
      return data
    },
    [loadMemberships, switchHousehold],
  )

  const joinByCode = useCallback(
    async (code) => {
      const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
      if (error) throw error
      await loadMemberships()
      switchHousehold(data)
      return data
    },
    [loadMemberships, switchHousehold],
  )

  const value = useMemo(
    () => ({
      loading,
      memberships,
      household: current?.households ?? null,
      householdId,
      role: current?.role ?? null,
      isAdmin: current?.role === 'admin',
      members,
      memberById: new Map(members.map((m) => [m.user_id, m])),
      refresh: loadMemberships,
      refreshMembers: loadMembers,
      createHousehold,
      joinByCode,
      switchHousehold,
    }),
    [loading, memberships, current, householdId, members, loadMemberships, loadMembers, createHousehold, joinByCode, switchHousehold],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export const useHousehold = () => useContext(HouseholdContext)
