import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import ToastStack from '../components/Toast'

const ToastContext = createContext(null)

export function vibrate(pattern = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* sem suporte */
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const show = useCallback(
    (message, opts = {}) => {
      const id = ++idRef.current
      const type = opts.type || 'success'
      setToasts((t) => [...t.slice(-2), { id, message, type, action: opts.action }])
      vibrate(type === 'error' ? [30, 60, 30] : 12)
      setTimeout(() => dismiss(id), opts.duration || (type === 'error' ? 4500 : 3000))
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      show,
      success: (m, o) => show(m, { ...o, type: 'success' }),
      error: (m, o) => show(m, { ...o, type: 'error' }),
      info: (m, o) => show(m, { ...o, type: 'info' }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
