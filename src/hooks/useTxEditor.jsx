import { useState } from 'react'
import Sheet from '../components/Sheet'
import TransactionForm from '../components/TransactionForm'
import { useConfirm } from '../context/ConfirmContext'
import { useToast } from '../context/ToastContext'
import { useData } from '../context/DataContext'
import { useFinanceActions } from './useFinanceActions'

/** Editar / excluir / marcar como pago, com escolha "só esta" ou "esta e as próximas". */
export function useTxEditor() {
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const actions = useFinanceActions()
  const confirm = useConfirm()
  const toast = useToast()
  const data = useData()

  const askScope = (tx, verb) => {
    if (!tx.installment_group_id && !tx.recurring_id) return Promise.resolve('one')
    const isInst = Boolean(tx.installment_group_id)
    return confirm({
      title: `${verb} ${isInst ? 'parcela' : 'lançamento fixo'}`,
      message: isInst
        ? `Esta é a parcela ${tx.installment_number} de ${tx.installment_total}.`
        : 'Este lançamento se repete todo mês.',
      options: [
        { label: isInst ? 'Só esta parcela' : 'Só este mês', value: 'one', tone: 'ghost' },
        { label: isInst ? 'Esta e as próximas' : 'Este e os próximos', value: 'future', tone: verb === 'Excluir' ? 'danger' : 'primary' },
      ],
    })
  }

  const save = async (form) => {
    const tx = editing
    const scope = await askScope(tx, 'Editar')
    if (!scope) return
    setBusy(true)
    try {
      await actions.updateTransaction(tx, form, scope)
      toast.success('Lançamento atualizado')
      setEditing(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const deleteTx = async (tx) => {
    let scope = 'one'
    if (tx.installment_group_id || tx.recurring_id) {
      scope = await askScope(tx, 'Excluir')
      if (!scope) return
    }
    try {
      await actions.deleteTransaction(tx, scope)
      setEditing(null)
      if (scope === 'one') {
        toast.success('Lançamento excluído', {
          action: { label: 'Desfazer', onClick: () => data.insert('transactions', tx).catch((e) => toast.error(e.message)) },
        })
      } else toast.success('Lançamentos excluídos')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const togglePaid = async (tx) => {
    try {
      await actions.togglePaid(tx)
      toast.success(tx.paid ? 'Marcado como pendente' : tx.type === 'income' ? 'Marcado como recebido' : 'Marcado como pago')
    } catch (e) {
      toast.error(e.message)
    }
  }

  const sheet = (
    <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.type === 'income' ? 'Editar ganho' : 'Editar gasto'}>
      {editing && (
        <div className="stack">
          {editing.kind === 'invoice_payment' ? (
            <p className="muted">Pagamentos de fatura não podem ser editados. Você pode excluí-lo para reabrir os itens manualmente.</p>
          ) : (
            <TransactionForm key={editing.id} type={editing.type} tx={editing} onSubmit={save} busy={busy} submitLabel="Salvar alterações" />
          )}
          <button type="button" className="btn btn-danger btn-block" onClick={() => deleteTx(editing)}>
            Excluir lançamento
          </button>
        </div>
      )}
    </Sheet>
  )

  return { editTx: setEditing, deleteTx, togglePaid, sheet }
}
