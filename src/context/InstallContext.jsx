import { createContext, useContext, useEffect, useState } from 'react'
import { isStandalone } from '../lib/push'

const InstallContext = createContext(null)

// captura o evento cedo (antes do React montar)
let deferred = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
})

export function InstallProvider({ children }) {
  const [prompt, setPrompt] = useState(deferred)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return false
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    setPrompt(null)
    return outcome === 'accepted'
  }

  return <InstallContext.Provider value={{ canInstall: Boolean(prompt) && !installed, installed, install }}>{children}</InstallContext.Provider>
}

export const useInstall = () => useContext(InstallContext)
