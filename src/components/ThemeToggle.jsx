import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

/** Alterna claro/escuro com um toque (a opção "Sistema" fica em Configurações). */
export default function ThemeToggle({ className = 'icon-btn' }) {
  const { resolved, setMode } = useTheme()
  const dark = resolved === 'dark'
  return (
    <button
      type="button"
      className={className}
      onClick={() => setMode(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
      title={dark ? 'Modo claro' : 'Modo escuro'}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
