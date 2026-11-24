import './Logo.css'

/**
 * Logo M&R Controle Financeiro.
 * variant: 'auto' (original no claro, branca no escuro) | 'color' | 'white'
 */
export default function Logo({ variant = 'auto', height = 48, className = '', alt = 'M&R Controle Financeiro' }) {
  const style = { height }
  if (variant === 'color') return <img src="/brand/logo.png" alt={alt} className={`logo ${className}`} style={style} />
  if (variant === 'white') return <img src="/brand/logo-branca.png" alt={alt} className={`logo ${className}`} style={style} />
  return (
    <span className={`logo-auto ${className}`} role="img" aria-label={alt}>
      <img src="/brand/logo.png" alt="" className="logo logo--light" style={style} />
      <img src="/brand/logo-branca.png" alt="" className="logo logo--dark" style={style} />
    </span>
  )
}
