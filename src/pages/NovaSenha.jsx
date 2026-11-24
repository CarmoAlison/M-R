import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthBrand, PasswordInput } from '../components/AuthBits'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { friendlyError } from '../lib/errors'

/** Destino do link de recuperação enviado por e-mail. */
export default function NovaSenha() {
  const { updatePassword, session, loading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    try {
      await updatePassword(password)
      sessionStorage.setItem('cf-fresh-login', '1')
      toast.success('Senha atualizada!')
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!loading && !session) {
    return (
      <div className="auth-page">
        <AuthBrand logoHeight={64} title="Link expirado" subtitle="Peça um novo link de recuperação." />
        <Link className="btn btn-primary btn-block" to="/recuperar-senha">Enviar novo link</Link>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <AuthBrand logoHeight={64} title="Nova senha" subtitle="Escolha uma senha que você vá lembrar." />
      <form className="card auth-card slide-up" onSubmit={submit}>
        <PasswordInput label="Nova senha" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <PasswordInput label="Confirmar senha" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        {error && <p className="field-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? <span className="spinner" aria-label="Salvando" /> : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  )
}
