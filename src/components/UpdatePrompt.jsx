import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import './UpdatePrompt.css'

/** Avisa quando há nova versão do app (service worker em espera). */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // verifica atualizações a cada hora
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="update-prompt slide-up" role="status">
      <RefreshCw size={20} aria-hidden="true" />
      <span className="grow">{needRefresh ? 'Nova versão disponível!' : 'Pronto para usar offline.'}</span>
      {needRefresh && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => updateServiceWorker(true)}>
          Atualizar
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
      >
        {needRefresh ? 'Depois' : 'Ok'}
      </button>
    </div>
  )
}
