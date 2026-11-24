import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, RefreshCw } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDate } from '../lib/dates'
import { brl, uuid } from '../lib/format'
import { invoiceMonthValue } from '../lib/finance'
import { findDuplicates, guessCategory, parseStatement, readFileText } from '../lib/importer'
import './Importar.css'

const CHUNK = 200

export default function Importar() {
  const data = useData()
  const { accounts, cards, categories, transactions } = data
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [dest, setDest] = useState(accounts[0] ? `acc:${accounts[0].id}` : cards[0] ? `card:${cards[0].id}` : '')
  const [fileName, setFileName] = useState('')
  const [raw, setRaw] = useState([]) // linhas lidas do arquivo
  const [invert, setInvert] = useState(false)
  const [rows, setRows] = useState([]) // linhas editáveis
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [kind, destId] = dest.split(':')
  const card = kind === 'card' ? cards.find((c) => c.id === destId) : null

  // monta as linhas editáveis a partir do arquivo + destino + inversão de sinal
  const build = (list, inv, d) => {
    const [k, id] = d.split(':')
    const isCard = k === 'card'
    const normalized = list.map((r) => ({ ...r, amount: inv ? -r.amount : r.amount }))
    const dup = findDuplicates(normalized, transactions, { accountId: isCard ? null : id, cardId: isCard ? id : null })
    return normalized.map((r, i) => {
      const type = r.amount < 0 ? 'expense' : 'income'
      // no cartão, valores positivos costumam ser pagamentos/estornos da fatura
      const skip = dup[i] || (isCard && type === 'income')
      return {
        key: `${i}-${r.fitid || r.date}`,
        date: r.date,
        description: r.description,
        amount: Math.abs(r.amount),
        type,
        category_id: guessCategory(r.description, type, categories),
        selected: !skip,
        duplicate: dup[i],
        cardIncome: isCard && type === 'income',
      }
    })
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const text = await readFileText(file)
      const list = parseStatement(text, file.name).sort((a, b) => b.date.localeCompare(a.date))
      if (!list.length) throw new Error('Não encontrei lançamentos neste arquivo.')
      // fatura de cartão em CSV costuma trazer compras como valores positivos
      const inv = kind === 'card' && list.filter((r) => r.amount > 0).length > list.length / 2
      setFileName(file.name)
      setRaw(list)
      setInvert(inv)
      setRows(build(list, inv, dest))
    } catch (err) {
      setError(err.message)
      setRaw([])
      setRows([])
    }
  }

  const changeDest = (d) => {
    setDest(d)
    if (raw.length) setRows(build(raw, invert, d))
  }
  const toggleInvert = (v) => {
    setInvert(v)
    setRows(build(raw, v, dest))
  }
  const patchRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const setAll = (v) => setRows((rs) => rs.map((r) => ({ ...r, selected: v })))

  const chosen = rows.filter((r) => r.selected)
  const totals = useMemo(
    () => ({
      income: chosen.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0),
      expense: chosen.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0),
    }),
    [chosen],
  )

  const doImport = async () => {
    if (!chosen.length) return toast.error('Selecione ao menos um lançamento.')
    setBusy(true)
    try {
      const txs = chosen.map((r) => ({
        id: uuid(),
        type: r.type,
        kind: 'normal',
        amount: r.amount,
        description: r.description.slice(0, 80),
        date: r.date,
        category_id: r.category_id,
        account_id: card ? null : destId,
        card_id: card ? card.id : null,
        paid: !card,
        invoice_month: invoiceMonthValue(r.date, card),
        user_id: user.id,
        paid_by: user.id,
        shared: true,
      }))
      for (let i = 0; i < txs.length; i += CHUNK) await data.insert('transactions', txs.slice(i, i + CHUNK))
      toast.success(`${txs.length} lançamentos importados`)
      navigate('/lancamentos?tipo=all')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const catsFor = (type) => categories.filter((c) => c.type === type && !c.archived)

  return (
    <div className="page page--narrow">
      <PageHeader title="Importar extrato" subtitle="CSV ou OFX do banco ou do cartão" back />

      <section className="card stack">
        <label className="field">
          <span>Para onde vão os lançamentos</span>
          <select className="select" value={dest} onChange={(e) => changeDest(e.target.value)}>
            {accounts.length > 0 && (
              <optgroup label="Contas">
                {accounts.map((a) => <option key={a.id} value={`acc:${a.id}`}>{a.name}</option>)}
              </optgroup>
            )}
            {cards.length > 0 && (
              <optgroup label="Cartões (fatura)">
                {cards.map((c) => <option key={c.id} value={`card:${c.id}`}>{c.name}</option>)}
              </optgroup>
            )}
          </select>
        </label>

        <button type="button" className="import-drop" onClick={() => fileRef.current?.click()} disabled={!dest}>
          <FileUp size={28} />
          <span className="strong">{fileName || 'Escolher arquivo do extrato'}</span>
          <span className="tiny muted">{fileName ? 'Toque para trocar' : 'Aceita .csv e .ofx (exporte pelo app ou site do banco)'}</span>
        </button>
        <input ref={fileRef} type="file" accept=".csv,.ofx,.txt,text/csv,application/x-ofx" hidden onChange={onFile} />
        {error && <p className="field-error" role="alert">{error}</p>}

        {raw.length > 0 && (
          <label className="switch">
            <span>
              Inverter sinais
              <small className="muted block">Use se gastos aparecerem como ganhos (comum em CSV de fatura de cartão)</small>
            </span>
            <input type="checkbox" checked={invert} onChange={(e) => toggleInvert(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
          </label>
        )}
      </section>

      {rows.length > 0 && (
        <>
          <div className="row-between">
            <h2 className="section-title">{rows.length} lançamentos encontrados</h2>
            <div className="row" style={{ gap: 4 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(true)}>Todos</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(false)}>Nenhum</button>
            </div>
          </div>

          <section className="card import-list">
            {rows.map((r) => (
              <div key={r.key} className={`import-row ${r.selected ? '' : 'is-off'}`}>
                <input
                  type="checkbox"
                  className="import-check"
                  checked={r.selected}
                  onChange={(e) => patchRow(r.key, { selected: e.target.checked })}
                  aria-label={`Importar ${r.description}`}
                />
                <div className="grow stack-sm" style={{ gap: 4, minWidth: 0 }}>
                  <div className="row-between">
                    <span className="small strong ellipsis">{r.description}</span>
                    <span className={`num strong small ${r.type === 'income' ? 't-income' : 't-expense'}`}>
                      {r.type === 'income' ? '+' : '−'} {brl(r.amount)}
                    </span>
                  </div>
                  <div className="row import-meta">
                    <span className="tiny muted">{formatDate(r.date, { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                    <select className="import-cat" value={r.category_id || ''} onChange={(e) => patchRow(r.key, { category_id: e.target.value })} aria-label="Categoria">
                      {catsFor(r.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {r.duplicate && <span className="badge badge--warning">já lançado?</span>}
                    {r.cardIncome && <span className="badge">pagamento/estorno</span>}
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="card import-footer">
            <div className="tiny">
              <strong>{chosen.length}</strong> selecionados · <span className="t-expense">{brl(totals.expense)}</span> em gastos
              {totals.income > 0 && <> · <span className="t-income">{brl(totals.income)}</span> em ganhos</>}
            </div>
            <div className="grid-2">
              <button type="button" className="btn" onClick={() => { setRows([]); setRaw([]); setFileName('') }}>
                <RefreshCw size={16} /> Recomeçar
              </button>
              <button type="button" className="btn btn-primary" onClick={doImport} disabled={busy || !chosen.length}>
                {busy ? <span className="spinner" aria-label="Importando" /> : `Importar ${chosen.length}`}
              </button>
            </div>
          </div>
        </>
      )}

      {!rows.length && (
        <section className="card stack-sm import-help">
          <h2 className="card-title">Como exportar o extrato</h2>
          <ul className="small muted">
            <li>No app do banco, procure “Extrato” → “Exportar” ou “Compartilhar” e escolha <strong>OFX</strong> (Money/Quicken) ou <strong>CSV</strong>.</li>
            <li>Nubank: na fatura do cartão, “Exportar fatura” gera um CSV.</li>
            <li>O app sugere as categorias pela descrição e marca como “já lançado?” o que tiver mesma data e valor.</li>
          </ul>
        </section>
      )}
    </div>
  )
}
