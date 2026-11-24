import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthBrand } from '../components/AuthBits'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'

export default function RecuperarSenha() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <AuthBrand logoHeight={64} title="Recuperar senha" subtitle="Enviaremos um link para você criar uma nova senha." />
      {sent ? (
        <div className="card auth-card pop-in">
          <p>
            Se existir uma conta com <strong>{email}</strong>, você vai receber um e-mail em instantes. Confira também a caixa de spam.
          </p>
          <Link className="btn btn-primary btn-block" to="/login">Voltar ao login</Link>
        </div>
      ) : (
        <form className="card auth-card slide-up" onSubmit={submit}>
          <label className="field">
            <span>E-mail</span>
            <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? <span className="spinner" aria-label="Enviando" /> : 'Enviar link'}
          </button>
        </form>
      )}
      <div className="auth-links">
        <Link to="/login">Voltar</Link>
      </div>
    </div>
  )
}
