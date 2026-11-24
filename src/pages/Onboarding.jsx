import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { House, KeyRound, Landmark, Sparkles } from 'lucide-react'
import { AuthBrand } from '../components/AuthBits'
import MoneyInput from '../components/MoneyInput'
import { CategoryBubble } from '../components/CategoryIcon'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { supabase } from '../lib/supabaseClient'
import { friendlyError } from '../lib/errors'
import { firstName, uuid } from '../lib/format'
import './Onboarding.css'

const FLAG = 'cf-onboarding-step'

export default function Onboarding() {
  const { profile, signOut } = useAuth()
  const { householdId, createHousehold, joinByCode } = useHousehold()
  const data = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [step, setStep] = useState(() => sessionStorage.getItem(FLAG) || 'house')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState(params.get('codigo') ? 'join' : 'create')
  const [houseName, setHouseName] = useState('')
  const [code, setCode] = useState(params.get('codigo') || '')
  const [invites, setInvites] = useState([])
  const [account, setAccount] = useState({ name: 'Conta corrente', type: 'checking', initial_balance: 0 })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    supabase.rpc('my_invites').then(({ data: list }) => setInvites(list || []))
  }, [])

  useEffect(() => {
    if (step === 'house') sessionStorage.removeItem(FLAG)
    else sessionStorage.setItem(FLAG, step)
  }, [step])

  useEffect(() => {
    if (step === 'categories' && !selected && data.categories.length) {
      setSelected(new Set(data.categories.map((c) => c.id)))
    }
  }, [step, data.categories, selected])

  // já tem casa e não está no meio do onboarding
  if (householdId && step === 'house' && !busy) return <Navigate to="/" replace />

  const run = async (fn) => {
    setError('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(friendlyError(e.cause || e))
    } finally {
      setBusy(false)
    }
  }

  const create = (e) => {
    e.preventDefault()
    if (!houseName.trim()) return setError('Dê um nome para a casa.')
    run(async () => {
      sessionStorage.setItem(FLAG, 'account')
      await createHousehold(houseName.trim())
      setStep('account')
    })
  }

  const join = (c) =>
    run(async () => {
      await joinByCode(c)
      sessionStorage.removeItem(FLAG)
      toast.success('Bem-vindo(a) à casa!')
      navigate('/', { replace: true })
    })

  const saveAccount = (e) => {
    e.preventDefault()
    run(async () => {
      await data.insert('accounts', { id: uuid(), ...account, name: account.name.trim() || 'Conta' })
      setStep('categories')
    })
  }

  const finish = () =>
    run(async () => {
      const off = data.categories.filter((c) => !selected?.has(c.id)).map((c) => c.id)
      if (off.length) await data.update('categories', off, { archived: true })
      sessionStorage.removeItem(FLAG)
      toast.success('Tudo pronto! 🎉')
      navigate('/', { replace: true })
    })

  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const stepIndex = { house: 0, account: 1, categories: 2 }[step]

  return (
    <div className="auth-page onboarding">
      <div className="onb-steps" aria-label={`Passo ${stepIndex + 1} de 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`onb-step ${i <= stepIndex ? 'is-done' : ''}`} />
        ))}
      </div>

      {step === 'house' && (
        <>
          <AuthBrand logoHeight={64} title={`Olá${profile?.name ? `, ${firstName(profile.name)}` : ''}!`} subtitle="Vamos preparar a casa de vocês." />

          {invites.length > 0 && (
            <div className="card stack slide-up">
              <p className="strong">Você tem convite 💌</p>
              {invites.map((i) => (
                <button key={i.code} type="button" className="btn btn-primary btn-block" onClick={() => join(i.code)} disabled={busy}>
                  Entrar em “{i.household_name}”
                </button>
              ))}
            </div>
          )}

          <div className="segmented">
            <button type="button" aria-pressed={mode === 'create'} onClick={() => setMode('create')}>
              <House size={17} /> Criar casa
            </button>
            <button type="button" aria-pressed={mode === 'join'} onClick={() => setMode('join')}>
              <KeyRound size={17} /> Tenho um código
            </button>
          </div>

          {mode === 'create' ? (
            <form className="card auth-card slide-up" onSubmit={create}>
              <label className="field">
                <span>Nome da casa</span>
                <input className="input" placeholder="Ex.: Casa da Ana e do Léo" value={houseName} onChange={(e) => setHouseName(e.target.value)} maxLength={80} autoFocus />
              </label>
              {error && <p className="field-error" role="alert">{error}</p>}
              <button className="btn btn-primary btn-block" disabled={busy}>
                {busy ? <span className="spinner" aria-label="Criando" /> : 'Continuar'}
              </button>
            </form>
          ) : (
            <form
              className="card auth-card slide-up"
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) join(code)
              }}
            >
              <label className="field">
                <span>Código do convite</span>
                <input
                  className="input onb-code"
                  placeholder="ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </label>
              {error && <p className="field-error" role="alert">{error}</p>}
              <button className="btn btn-primary btn-block" disabled={busy || !code.trim()}>
                {busy ? <span className="spinner" aria-label="Entrando" /> : 'Entrar na casa'}
              </button>
            </form>
          )}
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            Sair
          </button>
        </>
      )}

      {step === 'account' && (
        <>
          <AuthBrand logoHeight={64} title="Primeira conta" subtitle="Onde fica o dinheiro do dia a dia? Dá para adicionar outras depois." />
          <form className="card auth-card slide-up" onSubmit={saveAccount}>
            <label className="field">
              <span>Nome</span>
              <input className="input" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} maxLength={40} />
            </label>
            <div className="segmented">
              {[
                ['checking', 'Corrente'],
                ['savings', 'Poupança'],
                ['wallet', 'Carteira'],
              ].map(([v, l]) => (
                <button key={v} type="button" aria-pressed={account.type === v} onClick={() => setAccount({ ...account, type: v })}>
                  {l}
                </button>
              ))}
            </div>
            <MoneyInput label="Saldo atual" value={account.initial_balance} onChange={(v) => setAccount({ ...account, initial_balance: v })} />
            {error && <p className="field-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={busy}>
              <Landmark size={18} /> Criar conta
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => setStep('categories')}>
              Pular por enquanto
            </button>
          </form>
        </>
      )}

      {step === 'categories' && (
        <>
          <AuthBrand logoHeight={64} title="Categorias" subtitle="Deixe marcadas as que fazem sentido para vocês." />
          <div className="card stack slide-up">
            {['expense', 'income'].map((type) => (
              <div key={type} className="stack-sm">
                <p className="section-title">{type === 'expense' ? 'Gastos' : 'Ganhos'}</p>
                <div className="onb-cats">
                  {data.categories
                    .filter((c) => c.type === type)
                    .map((c) => (
                      <button key={c.id} type="button" className="chip onb-cat" aria-pressed={selected?.has(c.id) || false} onClick={() => toggle(c.id)}>
                        <CategoryBubble category={c} size={24} />
                        {c.name}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            {!data.categories.length && <p className="muted">Carregando categorias…</p>}
            {error && <p className="field-error" role="alert">{error}</p>}
            <button type="button" className="btn btn-primary btn-block" onClick={finish} disabled={busy}>
              <Sparkles size={18} /> Começar
            </button>
          </div>
        </>
      )}
    </div>
  )
}
