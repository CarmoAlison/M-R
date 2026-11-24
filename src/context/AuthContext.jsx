import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export const AuthContext = createContext(null)
const PROFILE_CACHE = 'cf-profile'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_CACHE))
    } catch {
      return null
    }
  })
  const user = session?.user ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        localStorage.removeItem(PROFILE_CACHE)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // carrega o perfil (com cache para uso offline)
  useEffect(() => {
    if (!user) return
    let active = true
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        const p = data || { id: user.id, name: user.user_metadata?.name || user.email.split('@')[0] }
        setProfile(p)
        localStorage.setItem(PROFILE_CACHE, JSON.stringify(p))
      })
    return () => {
      active = false
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    sessionStorage.setItem('cf-fresh-login', '1') // login com senha dispensa o PIN nesta abertura
  }, [])

  const signUp = useCallback(async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    })
    if (error) throw error
    if (data.session) sessionStorage.setItem('cf-fresh-login', '1')
    return { needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    // limpa caches locais de dados (o PIN do dispositivo é removido por quem chamar, se preciso)
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cf-cache-') || k === 'cf-memberships' || k === 'cf-offline-queue')
      .forEach((k) => localStorage.removeItem(k))
  }, [])

  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setRecovery(false)
  }, [])

  const updateProfile = useCallback(
    async (patch) => {
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', user.id).select().single()
      if (error) throw error
      setProfile(data)
      localStorage.setItem(PROFILE_CACHE, JSON.stringify(data))
    },
    [user?.id], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const value = useMemo(
    () => ({ session, user, profile, loading, recovery, signIn, signUp, signOut, resetPassword, updatePassword, updateProfile }),
    [session, user, profile, loading, recovery, signIn, signUp, signOut, resetPassword, updatePassword, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
