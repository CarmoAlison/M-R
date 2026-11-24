import { CategoryBubble } from './CategoryIcon'
import './CategoryPicker.css'

export default function CategoryPicker({ categories, value, onChange, label = 'Categoria' }) {
  return (
    <fieldset className="category-picker">
      <legend className="field-label">{label}</legend>
      <div className="category-picker-grid" role="radiogroup">
        {categories.map((c) => {
          const active = c.id === value
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`category-option ${active ? 'is-active' : ''}`}
              style={active ? { borderColor: c.color, background: `${c.color}1f` } : undefined}
              onClick={() => onChange(c.id)}
            >
              <CategoryBubble category={c} size={38} />
              <span className="category-option-name">{c.name}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
