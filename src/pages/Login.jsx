import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthBrand, PasswordInput } from '../components/AuthBits'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signIn(email.trim(), password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthBrand subtitle="O controle financeiro da família, num lugar só." logoHeight={110} />
      <form className="card auth-card slide-up" onSubmit={submit}>
        <label className="field">
          <span>E-mail</span>
          <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="spinner" aria-label="Entrando" /> : 'Entrar'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/recuperar-senha">Esqueci minha senha</Link>
        <span className="muted">
          Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
        </span>
      </div>
    </div>
  )
}
