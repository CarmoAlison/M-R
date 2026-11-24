import { useState } from 'react'
import { avatarColor, initials } from '../lib/format'

/** Foto de perfil (se houver) ou iniciais sobre uma cor estável. */
export default function Avatar({ id, name, src, size = 32, title }) {
  const [broken, setBroken] = useState(false)
  const label = title ?? name
  const style = { width: size, height: size, background: avatarColor(id || name), fontSize: size * 0.38 }

  if (src && !broken) {
    return (
      <img
        className="avatar avatar--img"
        src={src}
        alt={label || ''}
        title={label}
        style={style}
        onError={() => setBroken(true)}
        loading="lazy"
        decoding="async"
      />
    )
  }
  return (
    <span className="avatar" style={style} title={label} aria-label={label} role="img">
      {initials(name)}
    </span>
  )
}
