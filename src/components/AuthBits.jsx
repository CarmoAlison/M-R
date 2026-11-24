import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import '../pages/Auth.css'

export function AuthBrand({ title, subtitle, logoHeight = 96 }) {
  return (
    <div className="auth-brand slide-up">
      <ThemeToggle className="icon-btn auth-theme" />
      <Logo height={logoHeight} className="auth-logo-img" />
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export function PasswordInput({ label = 'Senha', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <label className="field">
      <span>{label}</span>
      <div className="password-field">
        <input className="input" type={show ? 'text' : 'password'} {...props} />
        <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}>
          {show ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </div>
    </label>
  )
}
