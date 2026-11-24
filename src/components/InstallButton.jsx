import { Download } from 'lucide-react'
import { useInstall } from '../context/InstallContext'
import { useToast } from '../context/ToastContext'

/** "Instalar app": instala com um toque quando possível; senão abre o passo a passo. Some se já instalado. */
export default function InstallButton({ className = 'btn btn-primary btn-block', label = 'Instalar app', iconSize = 18 }) {
  const { installed, install } = useInstall()
  const toast = useToast()
  if (installed) return null
  const onClick = async () => {
    const ok = await install()
    if (ok) toast.success('App instalado! Procure o ícone M&R na sua tela inicial.')
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      <Download size={iconSize} /> {label}
    </button>
  )
}
