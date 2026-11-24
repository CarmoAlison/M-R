import { useState } from 'react'
import { Plus } from 'lucide-react'
import Sheet from './Sheet'
import ColorPicker from './ColorPicker'
import CategoryIcon, { CATEGORY_COLORS, CATEGORY_ICON_CHOICES, CategoryBubble } from './CategoryIcon'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { uuid } from '../lib/format'
import './CategoryManager.css'

/** Lista + criação/edição/arquivamento de categorias. */
export default function CategoryManager() {
  const data = useData()
  const toast = useToast()
  const [type, setType] = useState('expense')
  const [form, setForm] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  const list = data.categories.filter((c) => c.type === type && (showArchived || !c.archived))

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Dê um nome para a categoria.')
    try {
      const row = { name: form.name.trim(), icon: form.icon, color: form.color, archived: form.archived, type: form.type }
      if (form.id) await data.update('categories', form.id, row)
      else await data.insert('categories', { id: uuid(), ...row })
      toast.success(form.id ? 'Categoria atualizada' : 'Categoria criada')
      setForm(null)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="stack">
      <div className="segmented">
        <button type="button" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>Gastos</button>
        <button type="button" aria-pressed={type === 'income'} onClick={() => setType('income')}>Ganhos</button>
      </div>
      <div className="list">
        {list.map((c) => (
          <button key={c.id} type="button" className="link-row" onClick={() => setForm({ ...c })} style={{ opacity: c.archived ? 0.55 : 1 }}>
            <CategoryBubble category={c} size={36} />
            <span className="grow">{c.name}</span>
            {c.archived && <span className="badge">arquivada</span>}
          </button>
        ))}
      </div>
      <label className="switch small">
        <span>Mostrar arquivadas</span>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        <span className="switch-track" aria-hidden="true" />
      </label>
      <button type="button" className="btn btn-block" onClick={() => setForm({ name: '', icon: 'ellipsis', color: CATEGORY_COLORS[0], archived: false, type })}>
        <Plus size={18} /> Nova categoria
      </button>

      <Sheet open={Boolean(form)} onClose={() => setForm(null)} title={form?.id ? 'Editar categoria' : 'Nova categoria'}>
        {form && (
          <form className="stack" onSubmit={save}>
            <div className="row">
              <CategoryBubble category={form} size={52} />
              <label className="field grow">
                <span>Nome</span>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={30} data-autofocus />
              </label>
            </div>
            <div className="field">
              <span className="field-label">Ícone</span>
              <div className="icon-grid" role="radiogroup" aria-label="Ícone">
                {CATEGORY_ICON_CHOICES.map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={form.icon === i}
                    aria-label={i}
                    className="icon-choice"
                    style={form.icon === i ? { background: `${form.color}33`, color: form.color, borderColor: form.color } : undefined}
                    onClick={() => setForm({ ...form, icon: i })}
                  >
                    <CategoryIcon name={i} size={20} />
                  </button>
                ))}
              </div>
            </div>
            <ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} />
            {form.id && (
              <label className="switch">
                <span>Arquivada <small className="muted">(some dos formulários, mantém o histórico)</small></span>
                <input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} />
                <span className="switch-track" aria-hidden="true" />
              </label>
            )}
            <button className="btn btn-primary btn-block">Salvar</button>
          </form>
        )}
      </Sheet>
    </div>
  )
}
