import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, Crown, House, Mail, Share2, Trash, UserPlus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { supabase } from '../lib/supabaseClient'
import { friendlyError } from '../lib/errors'
import { formatDate } from '../lib/dates'
import './Familia.css'

export default function Familia() {
  const { user } = useAuth()
  const hh = useHousehold()
  const { household, householdId, isAdmin, members, memberships } = hh
  const toast = useToast()
  const confirm = useConfirm()
  const [params] = useSearchParams()
  const [invites, setInvites] = useState([])
  const [inviteSheet, setInviteSheet] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState(household?.name || '')
  const [code, setCode] = useState(params.get('codigo') || '')
  const [newHouse, setNewHouse] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setName(household?.name || ''), [household?.name])

  const loadInvites = useCallback(async () => {
    if (!isAdmin || !householdId) return
    const { data } = await supabase
      .from('household_invites')
      .select('*')
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setInvites(data || [])
  }, [isAdmin, householdId])

  useEffect(() => {
    loadInvites()
  }, [loadInvites])

  const run = async (fn, msg) => {
    setBusy(true)
    try {
      await fn()
      if (msg) toast.success(msg)
      return true
    } catch (e) {
      toast.error(friendlyError(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const link = (c) => `${window.location.origin}/familia?codigo=${c}`

  const share = async (inv) => {
    const text = `Entre na nossa casa “${household.name}” no app M&R Controle Financeiro. Código: ${inv.code}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Convite', text, url: link(inv.code) })
        return
      } catch {
        /* cancelado */
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${link(inv.code)}`)
    toast.success('Convite copiado')
  }

  const createInvite = (e) => {
    e.preventDefault()
    run(async () => {
      const { data, error } = await supabase
        .from('household_invites')
        .insert({ household_id: householdId, email: email.trim() || null })
        .select()
        .single()
      if (error) throw error
      setEmail('')
      setInviteSheet(false)
      await loadInvites()
      share(data)
    }, 'Convite criado')
  }

  const revoke = (inv) =>
    run(async () => {
      const { error } = await supabase.from('household_invites').update({ status: 'revoked' }).eq('id', inv.id)
      if (error) throw error
      await loadInvites()
    }, 'Convite cancelado')

  const removeMember = async (m) => {
    const self = m.user_id === user.id
    const ok = await confirm({
      title: self ? 'Sair da casa?' : `Remover ${m.profiles?.name || 'membro'}?`,
      message: self ? 'Você deixará de ver os lançamentos desta casa.' : 'A pessoa perde o acesso aos dados da casa. Os lançamentos dela continuam.',
      confirmLabel: self ? 'Sair' : 'Remover',
      tone: 'danger',
    })
    if (!ok) return
    run(async () => {
      const { error } = await supabase.from('household_members').delete().eq('household_id', householdId).eq('user_id', m.user_id)
      if (error) throw error
      if (self) {
        localStorage.removeItem('cf-household')
        await hh.refresh()
      } else await hh.refreshMembers()
    }, self ? 'Você saiu da casa' : 'Membro removido')
  }

  const toggleAdmin = (m) =>
    run(async () => {
      const { error } = await supabase
        .from('household_members')
        .update({ role: m.role === 'admin' ? 'member' : 'admin' })
        .eq('household_id', householdId)
        .eq('user_id', m.user_id)
      if (error) throw error
      await hh.refreshMembers()
    }, 'Papel atualizado')

  const rename = (e) => {
    e.preventDefault()
    if (!name.trim() || name === household.name) return
    run(async () => {
      const { error } = await supabase.from('households').update({ name: name.trim() }).eq('id', householdId)
      if (error) throw error
      await hh.refresh()
    }, 'Nome atualizado')
  }

  const join = (e) => {
    e.preventDefault()
    run(async () => {
      await hh.joinByCode(code)
      setCode('')
    }, 'Você entrou na casa!')
  }

  const create = (e) => {
    e.preventDefault()
    if (!newHouse.trim()) return
    run(async () => {
      await hh.createHousehold(newHouse.trim())
      setNewHouse('')
    }, 'Casa criada')
  }

  const admins = members.filter((m) => m.role === 'admin').length

  return (
    <div className="page page--narrow">
      <PageHeader title="Família" back />

      <section className="card stack">
        <div className="row">
          <span className="icon-bubble family-house"><House size={22} /></span>
          {isAdmin ? (
            <form className="grow row" onSubmit={rename}>
              <label className="grow">
                <span className="sr-only">Nome da casa</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
              </label>
              {name !== household?.name && <button className="btn btn-primary btn-sm" disabled={busy}>Salvar</button>}
            </form>
          ) : (
            <h2 className="grow">{household?.name}</h2>
          )}
        </div>
      </section>

      <div className="row-between">
        <h2 className="section-title">Membros ({members.length})</h2>
        {isAdmin && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInviteSheet(true)}>
            <UserPlus size={18} /> Convidar
          </button>
        )}
      </div>
      <section className="card list">
        {members.map((m) => (
          <div key={m.user_id} className="list-item">
            <Avatar id={m.user_id} name={m.profiles?.name} src={m.profiles?.avatar_url} size={40} />
            <div className="grow">
              <p className="strong">
                {m.profiles?.name || 'Membro'} {m.user_id === user.id && <span className="muted">(você)</span>}
              </p>
              <p className="tiny muted">
                {m.role === 'admin' ? 'Administrador(a)' : 'Membro'} · desde {formatDate(m.joined_at.slice(0, 10), { month: 'short', year: 'numeric' })}
              </p>
            </div>
            {isAdmin && m.user_id !== user.id && (
              <button type="button" className="icon-btn" onClick={() => toggleAdmin(m)} aria-label={m.role === 'admin' ? 'Tornar membro' : 'Tornar administrador'} title={m.role === 'admin' ? 'Tornar membro' : 'Tornar administrador'}>
                <Crown size={18} className={m.role === 'admin' ? 't-warning' : 'muted'} />
              </button>
            )}
            {(isAdmin || m.user_id === user.id) && !(m.user_id === user.id && m.role === 'admin' && admins === 1 && members.length > 1) && (
              <button type="button" className="icon-btn" onClick={() => removeMember(m)} aria-label={m.user_id === user.id ? 'Sair da casa' : `Remover ${m.profiles?.name}`}>
                <Trash size={18} />
              </button>
            )}
          </div>
        ))}
      </section>

      {isAdmin && invites.length > 0 && (
        <>
          <h2 className="section-title">Convites pendentes</h2>
          <section className="card list">
            {invites.map((inv) => (
              <div key={inv.id} className="list-item">
                <span className="invite-code">{inv.code}</span>
                <div className="grow">
                  <p className="small strong ellipsis">{inv.email || 'Qualquer pessoa com o código'}</p>
                  <p className="tiny muted">expira {formatDate(inv.expires_at.slice(0, 10))}</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => share(inv)} aria-label="Compartilhar convite"><Share2 size={18} /></button>
                <button type="button" className="icon-btn" onClick={() => revoke(inv)} aria-label="Cancelar convite"><Trash size={18} /></button>
              </div>
            ))}
          </section>
        </>
      )}

      {memberships.length > 1 && (
        <>
          <h2 className="section-title">Suas casas</h2>
          <section className="card list">
            {memberships.map((m) => (
              <button key={m.household_id} type="button" className="link-row" onClick={() => hh.switchHousehold(m.household_id)} aria-current={m.household_id === householdId}>
                <House size={20} />
                <span className="grow">{m.households?.name}</span>
                {m.household_id === householdId && <span className="badge badge--brand">atual</span>}
              </button>
            ))}
          </section>
        </>
      )}

      <h2 className="section-title">Entrar em outra casa</h2>
      <form className="card row" onSubmit={join}>
        <label className="grow">
          <span className="sr-only">Código do convite</span>
          <input className="input invite-input" placeholder="Código" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} autoCapitalize="characters" />
        </label>
        <button className="btn btn-primary" disabled={busy || !code.trim()}>Entrar</button>
      </form>

      <form className="card row" onSubmit={create}>
        <label className="grow">
          <span className="sr-only">Nome da nova casa</span>
          <input className="input" placeholder="Criar nova casa" value={newHouse} onChange={(e) => setNewHouse(e.target.value)} maxLength={80} />
        </label>
        <button className="btn" disabled={busy || !newHouse.trim()}>Criar</button>
      </form>

      <Sheet open={inviteSheet} onClose={() => setInviteSheet(false)} title="Convidar para a casa">
        <form className="stack" onSubmit={createInvite}>
          <p className="muted small">
            Geramos um código válido por 7 dias. Com e-mail, só essa pessoa pode usar (ela também verá o convite ao entrar). Sem e-mail, qualquer pessoa com o código entra.
          </p>
          <label className="field">
            <span>E-mail (opcional)</span>
            <div className="row">
              <Mail size={18} className="muted" aria-hidden="true" />
              <input className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@email.com" data-autofocus />
            </div>
          </label>
          <button className="btn btn-primary btn-block" disabled={busy}>
            <Copy size={18} /> Gerar convite
          </button>
        </form>
      </Sheet>
    </div>
  )
}
