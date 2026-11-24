import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getPinRecord, hasPin, verifyPin } from '../lib/pin'
import { useAuth } from './AuthContext'

const LockContext = createContext(null)
const HIDDEN_AT = 'cf-hidden-at'

export function LockProvider({ children }) {
  const { user } = useAuth()
  const [locked, setLocked] = useState(false)
  const [version, setVersion] = useState(0) // força releitura das configs do PIN
  const checkedFor = useRef(null)
  const userId = user?.id

  // bloqueia ao abrir o app (exceto logo após login com senha)
  useEffect(() => {
    if (!userId) {
      checkedFor.current = null
      setLocked(false)
      return
    }
    if (checkedFor.current === userId) return
    checkedFor.current = userId
    const fresh = sessionStorage.getItem('cf-fresh-login')
    sessionStorage.removeItem('cf-fresh-login')
    setLocked(hasPin(userId) && !fresh)
  }, [userId])

  // bloqueia após X minutos em segundo plano
  useEffect(() => {
    if (!userId) return
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        sessionStorage.setItem(HIDDEN_AT, String(Date.now()))
        return
      }
      const rec = getPinRecord(userId)
      const hiddenAt = Number(sessionStorage.getItem(HIDDEN_AT) || 0)
      if (!rec || !hiddenAt) return
      const minutes = rec.lockAfterMinutes ?? 1
      if (Date.now() - hiddenAt >= minutes * 60000) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [userId])

  const unlock = useCallback(
    async (pin) => {
      const res = await verifyPin(userId, pin)
      if (res.ok) setLocked(false)
      return res
    },
    [userId],
  )

  const value = useMemo(
    () => ({
      locked,
      pinEnabled: hasPin(userId),
      pinRecord: userId ? getPinRecord(userId) : null,
      unlock,
      lockNow: () => hasPin(userId) && setLocked(true),
      refresh: () => setVersion((v) => v + 1),
    }),
    [locked, userId, unlock, version], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>
}

export const useLock = () => useContext(LockContext)
