import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { BOTTOM_LEFT, BOTTOM_RIGHT } from './navItems'
import './BottomNav.css'

function Item({ to, label, icon: Icon, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}>
      <span className="nav-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="nav-label">{label}</span>
    </NavLink>
  )
}

export default function BottomNav({ onAdd }) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav-inner">
        {BOTTOM_LEFT.map((i) => <Item key={i.to} {...i} />)}
        <div className="nav-fab-slot">
          <button type="button" className="fab" onClick={onAdd} aria-label="Novo lançamento">
            <Plus size={28} strokeWidth={2.4} />
          </button>
        </div>
        {BOTTOM_RIGHT.map((i) => <Item key={i.to} {...i} />)}
      </div>
    </nav>
  )
}
