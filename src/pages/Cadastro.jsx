import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { AuthBrand, PasswordInput } from '../components/AuthBits'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'

export default function Cadastro() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    setBusy(true)
    try {
      const { needsConfirmation } = await signUp(name.trim(), email.trim(), password)
      if (needsConfirmation) setSent(true)
      else navigate('/onboarding', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-page">
        <div className="card auth-card pop-in" style={{ textAlign: 'center', alignItems: 'center' }}>
          <MailCheck size={44} className="t-income" />
          <h2>Confira seu e-mail</h2>
          <p className="muted">
            Enviamos um link de confirmação para <strong>{email}</strong>. Depois de confirmar, é só entrar.
          </p>
          <Link className="btn btn-primary btn-block" to="/login">Ir para o login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <AuthBrand logoHeight={64} title="Criar conta" subtitle="Leva menos de um minuto." />
      <form className="card auth-card slide-up" onSubmit={submit}>
        <label className="field">
          <span>Seu nome</span>
          <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="spinner" aria-label="Criando conta" /> : 'Criar conta'}
        </button>
      </form>
      <div className="auth-links">
        <span className="muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </span>
      </div>
    </div>
  )
}
