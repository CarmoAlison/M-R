import { useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, Trash } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useHousehold } from '../context/HouseholdContext'
import { useToast } from '../context/ToastContext'
import { deleteReceipt, isPdf, receiptUrl, uploadReceipt } from '../lib/receipts'
import { friendlyError } from '../lib/errors'
import './ReceiptField.css'

/** Anexar / ver / remover o comprovante de um lançamento já salvo. */
export default function ReceiptField({ tx }) {
  const data = useData()
  const { householdId } = useHousehold()
  const toast = useToast()
  const fileRef = useRef(null)
  const [path, setPath] = useState(tx.receipt_path || null)
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    if (!path) return setUrl(null)
    receiptUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null))
    return () => {
      alive = false
    }
  }, [path])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const newPath = await uploadReceipt(householdId, tx.id, file)
      await data.update('transactions', tx.id, { receipt_path: newPath })
      if (path) deleteReceipt(path).catch(() => {})
      setPath(newPath)
      toast.success('Comprovante anexado')
    } catch (err) {
      toast.error(err.message || friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await data.update('transactions', tx.id, { receipt_path: null })
      await deleteReceipt(path)
      setPath(null)
      toast.success('Comprovante removido')
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="receipt-field card card--flat card--tight">
      <div className="row-between">
        <span className="strong small">Comprovante</span>
        {busy && <span className="spinner" aria-label="Enviando" />}
      </div>
      {path ? (
        <div className="receipt-preview">
          {url && !isPdf(path) ? (
            <a href={url} target="_blank" rel="noreferrer" className="receipt-thumb">
              <img src={url} alt="Comprovante" />
            </a>
          ) : (
            <a href={url || '#'} target="_blank" rel="noreferrer" className="btn btn-sm">
              <FileText size={16} /> Abrir PDF
            </a>
          )}
          <div className="stack-sm">
            <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Paperclip size={16} /> Trocar
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
              <Trash size={16} /> Remover
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-sm btn-block" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Paperclip size={16} /> Anexar foto ou PDF
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={onFile} />
    </div>
  )
}
