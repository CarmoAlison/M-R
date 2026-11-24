import { useEffect, useState } from 'react'
import Logo from './Logo'
import PinPad from './PinPad'
import { useLock } from '../context/LockContext'
import { useAuth } from '../context/AuthContext'
import { clearPin } from '../lib/pin'
import { firstName } from '../lib/format'
import './LockScreen.css'

export default function LockScreen() {
  const { unlock, pinRecord } = useLock()
  const { user, profile, signOut } = useAuth()
  const [error, setError] = useState(0)
  const [message, setMessage] = useState('')
  const [lockedUntil, setLockedUntil] = useState(pinRecord?.lockedUntil || 0)
  const [now, setNow] = useState(Date.now())
  const blocked = lockedUntil > now

  useEffect(() => {
    if (!blocked) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [blocked])

  const onComplete = async (pin) => {
    const res = await unlock(pin)
    if (res.ok) return
    setError((e) => e + 1)
    if (res.lockedUntil) {
      setLockedUntil(res.lockedUntil)
      setNow(Date.now())
      setMessage('Muitas tentativas.')
    } else {
      setMessage(`PIN incorreto. ${res.remaining} ${res.remaining === 1 ? 'tentativa restante' : 'tentativas restantes'}.`)
    }
  }

  const forgot = async () => {
    clearPin(user.id)
    await signOut()
  }

  const seconds = Math.ceil((lockedUntil - now) / 1000)

  return (
    <div className="lock-screen fade-in" role="dialog" aria-modal="true" aria-label="App bloqueado">
      <div className="lock-top">
        <Logo height={72} />
        <h1>Olá{profile?.name ? `, ${firstName(profile.name)}` : ''}</h1>
      </div>
      <PinPad
        length={pinRecord?.length || 4}
        onComplete={onComplete}
        error={error}
        disabled={blocked}
        label={blocked ? `Aguarde ${seconds}s para tentar de novo` : 'Digite seu PIN'}
      />
      <p className="lock-message" aria-live="assertive">
        {message}
      </p>
      <button type="button" className="btn btn-ghost" onClick={forgot}>
        Esqueci o PIN
      </button>
    </div>
  )
}
