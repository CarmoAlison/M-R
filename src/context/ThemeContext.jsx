import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const KEY = 'cf-theme'

function resolve(mode) {
  if (mode !== 'system') return mode
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => localStorage.getItem(KEY) || 'light')
  const [resolved, setResolved] = useState(() => resolve(mode))

  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      const r = resolve(mode)
      setResolved(r)
      if (mode === 'system') root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', mode)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'dark' ? '#2D2622' : '#F8F5F1')
    }
    apply()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [mode])

  const setMode = useCallback((m) => {
    localStorage.setItem(KEY, m)
    setModeState(m)
  }, [])

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
