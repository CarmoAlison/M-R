import { Link, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Avatar from './Avatar'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../context/AuthContext'
import './PageHeader.css'

/**
 * Cabeçalho de página.
 * Celular: [voltar] título … [tema] [avatar]  +  ações numa linha abaixo.
 * Computador: [voltar] título … [ações]  (tema e perfil ficam no menu lateral).
 */
export default function PageHeader({ title, subtitle, back = false, actions }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  return (
    <header className={`page-header slide-up ${actions ? 'has-actions' : ''}`}>
      <div className="page-header-top">
        {back && (
          <button type="button" className="icon-btn icon-btn--soft page-back" onClick={() => navigate(-1)} aria-label="Voltar">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="page-heading">
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
          <h1 className="page-title">{title}</h1>
        </div>
        <div className="page-header-tools no-print">
          <ThemeToggle className="icon-btn page-theme" />
          {!back && (
            <Link to="/perfil" className="page-avatar" aria-label="Meu perfil">
              <Avatar id={user?.id} name={profile?.name || user?.email} src={profile?.avatar_url} size={40} title="" />
            </Link>
          )}
        </div>
      </div>
      {actions && <div className="page-header-actions no-print">{actions}</div>}
    </header>
  )
}
