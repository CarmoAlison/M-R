import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import InstallGuide from '../components/InstallGuide'
import { isIOS, isStandalone } from '../lib/push'

const InstallContext = createContext(null)

// captura o evento cedo (antes do React montar) — Chrome/Edge/Samsung
let deferred = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e
})

/** Descobre o ambiente para mostrar o passo a passo certo quando não há instalação automática. */
function detectPlatform() {
  const ua = navigator.userAgent
  if (/Instagram|FBAN|FBAV|WhatsApp|Line\/|TikTok/i.test(ua)) return 'in-app'
  if (isIOS()) return /CriOS|EdgiOS|FxiOS/i.test(ua) ? 'ios-other' : 'ios-safari'
  if (/Android/i.test(ua)) return /Firefox/i.test(ua) ? 'android-firefox' : 'android'
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return 'mac-safari'
  if (/Firefox/i.test(ua)) return 'desktop-firefox'
  return 'desktop'
}

export function InstallProvider({ children }) {
  const [prompt, setPrompt] = useState(deferred)
  const [installed, setInstalled] = useState(isStandalone())
  const [guide, setGuide] = useState(false)
  const platform = useMemo(detectPlatform, [])

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
      setGuide(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    const mq = window.matchMedia('(display-mode: standalone)')
    const onMode = () => setInstalled(isStandalone())
    mq.addEventListener?.('change', onMode)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener?.('change', onMode)
    }
  }, [])

  /** Instala com um toque quando o navegador permite; senão abre o guia. */
  const install = useCallback(async () => {
    if (prompt) {
      prompt.prompt()
      const { outcome } = await prompt.userChoice
      setPrompt(null)
      if (outcome === 'accepted') return true
      return false
    }
    setGuide(true)
    return false
  }, [prompt])

  const value = useMemo(
    () => ({
      installed,
      /** true quando o botão instala direto (sem passo a passo) */
      oneTap: Boolean(prompt),
      /** mantido por compatibilidade: há algo a oferecer? */
      canInstall: !installed,
      platform,
      install,
    }),
    [installed, prompt, platform, install],
  )

  return (
    <InstallContext.Provider value={value}>
      {children}
      <InstallGuide open={guide} onClose={() => setGuide(false)} platform={platform} />
    </InstallContext.Provider>
  )
}

export const useInstall = () => useContext(InstallContext)
