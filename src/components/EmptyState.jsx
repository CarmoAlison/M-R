import './EmptyState.css'

/** Estado vazio com ilustração leve (cofrinho/folhas) desenhada em SVG. */
export default function EmptyState({ title, message, action, variant = 'piggy' }) {
  return (
    <div className="empty-state fade-in">
      <svg viewBox="0 0 160 120" width="150" height="112" aria-hidden="true">
        <ellipse cx="80" cy="104" rx="56" ry="8" fill="var(--surface-2)" />
        {variant === 'piggy' ? (
          <g>
            <path d="M40 70c0-20 18-34 40-34s40 14 40 34-18 30-40 30-40-10-40-30z" fill="var(--brand)" opacity="0.9" />
            <circle cx="98" cy="62" r="3.5" fill="var(--card)" />
            <rect x="70" y="40" width="18" height="5" rx="2.5" fill="var(--card)" opacity="0.8" />
            <path d="M118 66c6 0 10 4 10 8s-4 6-10 6" fill="var(--brand-strong)" />
            <rect x="52" y="92" width="10" height="12" rx="4" fill="var(--brand-strong)" />
            <rect x="94" y="92" width="10" height="12" rx="4" fill="var(--brand-strong)" />
            <circle cx="80" cy="20" r="10" fill="var(--warning)" />
            <text x="80" y="24.5" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--card)">$</text>
          </g>
        ) : (
          <g>
            <rect x="44" y="30" width="72" height="70" rx="14" fill="var(--card-raised)" stroke="var(--surface-2)" strokeWidth="3" />
            <rect x="56" y="46" width="48" height="7" rx="3.5" fill="var(--surface-2)" />
            <rect x="56" y="62" width="36" height="7" rx="3.5" fill="var(--surface-2)" />
            <rect x="56" y="78" width="42" height="7" rx="3.5" fill="var(--surface-2)" />
            <circle cx="114" cy="34" r="14" fill="var(--income)" />
            <path d="M107 34l5 5 9-10" stroke="var(--card)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>
      <h3>{title}</h3>
      {message && <p className="muted">{message}</p>}
      {action}
    </div>
  )
}
