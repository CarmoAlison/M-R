import { CATEGORY_COLORS } from './CategoryIcon'
import './ColorPicker.css'

export default function ColorPicker({ value, onChange, colors = CATEGORY_COLORS }) {
  return (
    <div className="field">
      <span className="field-label" id="color-label">Cor</span>
      <div className="color-picker" role="radiogroup" aria-labelledby="color-label">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={`Cor ${c}`}
            className="color-swatch"
            style={{ background: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  )
}
