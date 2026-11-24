import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ChevronRight, House, KeyRound, LogOut, Mail, Settings, Trash } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import { PasswordInput } from '../components/AuthBits'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { currentMonth, formatDate } from '../lib/dates'
import { brl, sum } from '../lib/format'
import { isNormal } from '../lib/finance'
import { removeAvatar, uploadAvatar } from '../lib/avatar'
import { friendlyError } from '../lib/errors'
import './Perfil.css'

export default function Perfil() {
  const { user, profile, updateProfile, updatePassword, signOut } = useAuth()
  const { household, role, members, refreshMembers } = useHousehold()
  const { transactions } = useData()
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef(null)
  const [name, setName] = useState(profile?.name || '')
  const [uploading, setUploading] = useState(false)
  const [pwSheet, setPwSheet] = useState(false)
  const [pw, setPw] = useState({ password: '', confirm: '', error: '', busy: false })

  useEffect(() => setName(profile?.name || ''), [profile?.name])

  const me = members.find((m) => m.user_id === user?.id)

  const stats = useMemo(() => {
    const mine = transactions.filter((t) => t.user_id === user?.id && isNormal(t))
    const month = mine.filter((t) => t.date.startsWith(currentMonth()))
    return {
      total: mine.length,
      monthCount: month.length,
      monthExpense: sum(month.filter((t) => t.type === 'expense'), (t) => t.amount),
      monthIncome: sum(month.filter((t) => t.type === 'income'), (t) => t.amount),
    }
  }, [transactions, user?.id])

  const saveName = async (e) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('O nome não pode ficar vazio.')
    try {
      await updateProfile({ name: name.trim() })
      refreshMembers().catch(() => {})
      toast.success('Nome atualizado')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  const onPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      await updateProfile({ avatar_url: url })
      refreshMembers().catch(() => {})
      toast.success('Foto atualizada')
    } catch (err) {
      toast.error(String(err?.message).toLowerCase().includes('bucket') ? 'O armazenamento de fotos ainda não foi configurado (rode a migration 20261124000005_avatars.sql).' : friendlyError(err))
    } finally {
      setUploading(false)
    }
  }

  const deletePhoto = async () => {
    const ok = await confirm({ title: 'Remover foto?', message: 'Suas iniciais voltam a aparecer no lugar da foto.', confirmLabel: 'Remover', tone: 'danger' })
    if (!ok) return
    try {
      await removeAvatar(user.id)
      await updateProfile({ avatar_url: null })
      refreshMembers().catch(() => {})
      toast.success('Foto removida')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pw.password.length < 6) return setPw({ ...pw, error: 'A senha precisa ter pelo menos 6 caracteres.' })
    if (pw.password !== pw.confirm) return setPw({ ...pw, error: 'As senhas não conferem.' })
    setPw({ ...pw, busy: true, error: '' })
    try {
      await updatePassword(pw.password)
      toast.success('Senha alterada')
      setPwSheet(false)
      setPw({ password: '', confirm: '', error: '', busy: false })
    } catch (err) {
      setPw({ ...pw, busy: false, error: friendlyError(err) })
    }
  }

  const logout = async () => {
    const ok = await confirm({ title: 'Sair da conta?', message: 'Os dados ficam salvos na nuvem. Lançamentos offline ainda não sincronizados serão perdidos.', confirmLabel: 'Sair', tone: 'danger' })
    if (ok) await signOut()
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Meu perfil" back />

      <section className="card profile-hero slide-up">
        <div className="profile-photo">
          <Avatar id={user?.id} name={profile?.name || user?.email} src={profile?.avatar_url} size={104} />
          <button
            type="button"
            className="profile-photo-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={profile?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
          >
            {uploading ? <span className="spinner" /> : <Camera size={18} />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
        </div>
        <div className="profile-id">
          <h2>{profile?.name || 'Sem nome'}</h2>
          <p className="small muted">{user?.email}</p>
          {role && <span className={`badge ${role === 'admin' ? 'badge--brand' : ''}`}>{role === 'admin' ? 'Administrador(a)' : 'Membro'}</span>}
        </div>
        {profile?.avatar_url && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={deletePhoto}>
            <Trash size={16} /> Remover foto
          </button>
        )}
      </section>

      <section className="profile-stats stagger" aria-label="Seus lançamentos">
        <div className="card card--tight">
          <span className="tiny muted strong">Lançados no mês</span>
          <strong className="num">{stats.monthCount}</strong>
        </div>
        <div className="card card--tight">
          <span className="tiny muted strong">Gastos que lancei</span>
          <strong className="num t-expense">{brl(stats.monthExpense)}</strong>
        </div>
        <div className="card card--tight">
          <span className="tiny muted strong">Ganhos que lancei</span>
          <strong className="num t-income">{brl(stats.monthIncome)}</strong>
        </div>
        <div className="card card--tight">
          <span className="tiny muted strong">Total de lançamentos</span>
          <strong className="num">{stats.total}</strong>
        </div>
      </section>

      <section className="card stack">
        <h2 className="card-title">Dados pessoais</h2>
        <form className="row" onSubmit={saveName}>
          <label className="field grow">
            <span>Nome</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" />
          </label>
          {name.trim() && name !== profile?.name && <button className="btn btn-primary btn-sm profile-save">Salvar</button>}
        </form>
        <div className="profile-line">
          <Mail size={18} className="muted" aria-hidden="true" />
          <div className="grow">
            <span className="tiny muted strong block">E-mail</span>
            <span className="ellipsis block">{user?.email}</span>
          </div>
        </div>
        {user?.created_at && (
          <p className="tiny muted">Conta criada em {formatDate(user.created_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        )}
      </section>

      <section className="card list">
        <Link to="/familia" className="link-row">
          <span className="icon-bubble profile-icon"><House size={20} /></span>
          <span className="grow">
            <span className="block">{household?.name || 'Minha casa'}</span>
            <span className="tiny muted">
              {members.length} {members.length === 1 ? 'membro' : 'membros'}
              {me?.joined_at && ` · desde ${formatDate(me.joined_at.slice(0, 10), { month: 'short', year: 'numeric' })}`}
            </span>
          </span>
          <ChevronRight size={18} className="muted" />
        </Link>
        <button type="button" className="link-row" onClick={() => setPwSheet(true)}>
          <span className="icon-bubble profile-icon"><KeyRound size={20} /></span>
          <span className="grow">
            <span className="block">Alterar senha</span>
            <span className="tiny muted">Senha usada para entrar com e-mail</span>
          </span>
          <ChevronRight size={18} className="muted" />
        </button>
        <Link to="/config" className="link-row">
          <span className="icon-bubble profile-icon"><Settings size={20} /></span>
          <span className="grow">
            <span className="block">Configurações</span>
            <span className="tiny muted">PIN, notificações, tema e categorias</span>
          </span>
          <ChevronRight size={18} className="muted" />
        </Link>
      </section>

      <button type="button" className="btn btn-danger btn-block" onClick={logout}>
        <LogOut size={18} /> Sair da conta
      </button>

      <Sheet open={pwSheet} onClose={() => setPwSheet(false)} title="Alterar senha">
        <form className="stack" onSubmit={changePassword}>
          <PasswordInput label="Nova senha" autoComplete="new-password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} data-autofocus />
          <PasswordInput label="Confirmar nova senha" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
          {pw.error && <p className="field-error" role="alert">{pw.error}</p>}
          <button className="btn btn-primary btn-block" disabled={pw.busy}>
            {pw.busy ? <span className="spinner" aria-label="Salvando" /> : 'Salvar nova senha'}
          </button>
        </form>
      </Sheet>
    </div>
  )
}
