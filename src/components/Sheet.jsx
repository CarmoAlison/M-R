import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Sheet.css'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/** Bottom sheet acessível: Esc fecha, foco preso, arrastar para baixo fecha. */
export default function Sheet({ open, onClose, title, children, footer, size = 'auto' }) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const panelRef = useRef(null)
  const lastFocus = useRef(null)
  const drag = useRef({ y: 0, dy: 0, active: false })
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      lastFocus.current = document.activeElement
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => {
        setMounted(false)
        setClosing(false)
        lastFocus.current?.focus?.()
      }, 220)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mounted || closing) return
    const panel = panelRef.current
    const first = panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE)
    setTimeout(() => first?.focus({ preventScroll: true }), 30)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
      }
      if (e.key === 'Tab' && panel) {
        const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
        if (!nodes.length) return
        const [a, b] = [nodes[0], nodes[nodes.length - 1]]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [mounted, closing])

  if (!mounted) return null

  const onPointerDown = (e) => {
    drag.current = { y: e.clientY, dy: 0, active: true }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!drag.current.active) return
    const dy = Math.max(0, e.clientY - drag.current.y)
    drag.current.dy = dy
    if (panelRef.current) panelRef.current.style.transform = `translateY(${dy}px)`
  }
  const onPointerUp = () => {
    if (!drag.current.active) return
    drag.current.active = false
    if (panelRef.current) panelRef.current.style.transform = ''
    if (drag.current.dy > 90) onClose?.()
  }

  return createPortal(
    <div className={`sheet-root ${closing ? 'is-closing' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className={`sheet-panel sheet-panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div
          className="sheet-handle-area"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet-handle" />
        </div>
        {title && (
          <header className="sheet-header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
              <X size={20} />
            </button>
          </header>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
