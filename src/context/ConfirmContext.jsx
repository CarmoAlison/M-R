import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Sheet from '../components/Sheet'

const ConfirmContext = createContext(null)

/**
 * confirm({ title, message, options: [{ label, value, tone }] }) => Promise<value | null>
 * Sem `options`, mostra Confirmar/Cancelar e resolve true/null.
 */
export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback((opts) => {
    return new Promise((resolve) => {
      resolver.current = resolve
      setReq(opts)
    })
  }, [])

  const close = (value) => {
    resolver.current?.(value)
    resolver.current = null
    setReq(null)
  }

  const options = req?.options || [{ label: req?.confirmLabel || 'Confirmar', value: true, tone: req?.tone || 'primary' }]

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet open={Boolean(req)} onClose={() => close(null)} title={req?.title}>
        <div className="stack">
          {req?.message && <p className="muted">{req.message}</p>}
          {options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className={`btn btn-block ${o.tone === 'danger' ? 'btn-danger' : o.tone === 'ghost' ? '' : 'btn-primary'}`}
              onClick={() => close(o.value)}
            >
              {o.label}
            </button>
          ))}
          <button type="button" className="btn btn-ghost btn-block" onClick={() => close(null)}>
            Cancelar
          </button>
        </div>
      </Sheet>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
