import { Link, NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Logo from './Logo'
import Avatar from './Avatar'
import { SIDEBAR_GROUPS } from './navItems'
import ThemeToggle from './ThemeToggle'
import InstallButton from './InstallButton'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import './Sidebar.css'

/** Menu lateral fixo — só aparece em telas largas (computador/tablet deitado). */
export default function Sidebar({ onAdd }) {
  const { user, profile } = useAuth()
  const { household } = useHousehold()
  return (
    <aside className="sidebar" aria-label="Menu">
      <Link to="/" className="sidebar-logo" aria-label="Início">
        <Logo height={58} />
      </Link>

      <button type="button" className="btn btn-primary btn-block sidebar-add" onClick={onAdd}>
        <Plus size={20} /> Novo lançamento
      </button>

      <nav className="sidebar-nav">
        {SIDEBAR_GROUPS.map((g, i) => (
          <div key={i} className="sidebar-group">
            {g.title && <p className="sidebar-title">{g.title}</p>}
            {g.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-link ${isActive ? 'is-active' : ''}`}>
                <Icon size={19} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <InstallButton className="btn btn-sm btn-block sidebar-install" label="Instalar app" iconSize={16} />
      <div className="sidebar-foot">
      <Link to="/perfil" className="sidebar-profile">
        <Avatar id={user?.id} name={profile?.name || user?.email} src={profile?.avatar_url} size={38} />
        <span className="grow">
          <span className="strong block ellipsis">{profile?.name}</span>
          <span className="tiny muted block ellipsis">{household?.name}</span>
        </span>
      </Link>
      <ThemeToggle className="icon-btn sidebar-theme" />
      </div>
    </aside>
  )
}
