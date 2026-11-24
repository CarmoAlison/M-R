import { CircleCheck, Info, TriangleExclamationPoint, X } from 'lucide-react'
import './Toast.css'

const ICONS = { success: CircleCheck, error: TriangleExclamationPoint, info: Info }

export default function ToastStack({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" role="region" aria-label="Notificações" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info
        return (
          <div key={t.id} className={`toast toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon size={20} aria-hidden="true" />
            <span className="grow">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  t.action.onClick()
                  onDismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="toast-close" onClick={() => onDismiss(t.id)} aria-label="Dispensar">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
