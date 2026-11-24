import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Logo from '../components/Logo'
import InstallButton from '../components/InstallButton'
import { SIDEBAR_GROUPS } from '../components/navItems'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import './Mais.css'

const HINTS = {
  '/objetivos': 'Caixinhas: reserva, viagem, carro…',
  '/metas': 'Limite mensal por categoria',
  '/recorrentes': 'Contas fixas e parcelamentos',
  '/divisao': 'Quem pagou o quê e quem deve a quem',
  '/contas': 'Saldos, faturas e limites',
  '/importar': 'Trazer lançamentos do banco (CSV/OFX)',
  '/familia': 'Membros e convites',
  '/config': 'Tema, PIN, notificações e categorias',
}

// os itens da barra inferior (Início, Lançamentos, Relatório) não se repetem aqui
const GROUPS = SIDEBAR_GROUPS.filter((g) => g.title)

export default function Mais() {
  const { user, profile } = useAuth()
  const { household, members } = useHousehold()
  return (
    <div className="page page--narrow">
      <PageHeader title="Mais" />
      <Link to="/perfil" className="card mais-profile slide-up" aria-label="Abrir meu perfil">
        <Avatar id={user?.id} name={profile?.name || user?.email} src={profile?.avatar_url} size={56} />
        <div className="grow">
          <p className="strong">{profile?.name}</p>
          <p className="small muted">{household?.name} · {members.length} {members.length === 1 ? 'membro' : 'membros'}</p>
          <p className="tiny strong mais-profile-link">Ver meu perfil</p>
        </div>
        <ChevronRight size={18} className="muted" />
      </Link>

      <InstallButton className="btn btn-primary btn-block mais-install" label="Instalar o app no celular" />

      {GROUPS.map((g) => (
        <section key={g.title} className="stack-sm">
          <h2 className="section-title">{g.title}</h2>
          <nav className="card list stagger" aria-label={g.title}>
            {g.items.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} className="link-row">
                <span className="icon-bubble mais-icon"><Icon size={20} /></span>
                <span className="grow">
                  <span className="block">{label}</span>
                  <span className="tiny muted">{HINTS[to]}</span>
                </span>
                <ChevronRight size={18} className="muted" />
              </Link>
            ))}
          </nav>
        </section>
      ))}

      <div className="mais-brand">
        <Logo height={56} />
      </div>
    </div>
  )
}
