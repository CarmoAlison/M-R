import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './styles/theme.css'
import './styles/animations.css'
import App from './App'

// aplica o tema salvo antes do primeiro paint (evita "piscar")
const saved = localStorage.getItem('cf-theme')
// padrão: claro. "system" remove o atributo e segue o aparelho
if (saved !== 'system') document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
