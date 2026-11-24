import { Copy, EllipsisVertical, ExternalLink, MonitorDown, Share, SquarePlus } from 'lucide-react'
import Sheet from './Sheet'
import './InstallGuide.css'

const STEPS = {
  'ios-safari': {
    title: 'Instalar no iPhone',
    intro: 'A Apple não deixa o app se instalar sozinho, mas leva só 3 toques:',
    steps: [
      { icon: Share, text: <>Toque em <b>Compartilhar</b> na barra de baixo do Safari (o quadrado com a seta para cima).</> },
      { icon: SquarePlus, text: <>Role a lista e toque em <b>Adicionar à Tela de Início</b>.</> },
      { icon: null, text: <>Toque em <b>Adicionar</b>. O ícone M&amp;R aparece junto dos seus apps.</> },
    ],
    note: 'Depois, abra sempre pelo ícone: assim as notificações funcionam.',
  },
  'ios-other': {
    title: 'Instalar no iPhone',
    intro: 'No iPhone a instalação é pelo menu de compartilhar:',
    steps: [
      { icon: Share, text: <>Toque em <b>Compartilhar</b> (na barra de endereço, no canto superior direito).</> },
      { icon: SquarePlus, text: <>Escolha <b>Adicionar à Tela de Início</b>.</> },
      { icon: null, text: <>Toque em <b>Adicionar</b>.</> },
    ],
    note: 'Se não aparecer a opção, abra este endereço no Safari e siga os mesmos passos.',
  },
  android: {
    title: 'Instalar no Android',
    intro: 'Use o menu do navegador:',
    steps: [
      { icon: EllipsisVertical, text: <>Toque nos <b>três pontinhos</b> no canto superior direito.</> },
      { icon: SquarePlus, text: <>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</> },
      { icon: null, text: <>Confirme em <b>Instalar</b>.</> },
    ],
    note: 'Dica: no Chrome, o botão costuma instalar direto com um toque. Se não instalou, recarregue a página e tente de novo.',
  },
  'android-firefox': {
    title: 'Instalar no Android',
    intro: 'No Firefox:',
    steps: [
      { icon: EllipsisVertical, text: <>Toque nos <b>três pontinhos</b> do menu.</> },
      { icon: SquarePlus, text: <>Toque em <b>Instalar</b> ou <b>Adicionar à tela inicial</b>.</> },
    ],
    note: 'Para a melhor experiência (e notificações), recomendamos o Chrome.',
  },
  desktop: {
    title: 'Instalar no computador',
    intro: 'No Chrome ou no Edge:',
    steps: [
      { icon: MonitorDown, text: <>Clique no ícone de <b>instalar</b> no lado direito da barra de endereço.</> },
      { icon: null, text: <>Ou abra o menu <b>⋮</b> → <b>Transmitir, salvar e compartilhar</b> → <b>Instalar página como app</b>.</> },
    ],
    note: 'Se o ícone não aparecer, recarregue a página (Ctrl + R).',
  },
  'mac-safari': {
    title: 'Instalar no Mac',
    intro: 'No Safari:',
    steps: [
      { icon: Share, text: <>Clique em <b>Arquivo</b> → <b>Adicionar ao Dock</b> (ou no botão Compartilhar → Adicionar ao Dock).</> },
      { icon: null, text: <>Confirme em <b>Adicionar</b>.</> },
    ],
  },
  'desktop-firefox': {
    title: 'Instalar no computador',
    intro: 'O Firefox para computador não instala apps da web. Abra este endereço no Chrome ou no Edge e clique em “Instalar app”.',
    steps: [],
  },
  'in-app': {
    title: 'Abra no navegador',
    intro: 'Você abriu o link por dentro de outro app (WhatsApp, Instagram…), que não permite instalar.',
    steps: [
      { icon: ExternalLink, text: <>Toque nos <b>três pontinhos</b> (ou no ícone de compartilhar) e escolha <b>Abrir no navegador</b> / <b>Abrir no Safari</b>.</> },
      { icon: null, text: <>Lá, toque de novo em <b>Instalar app</b>.</> },
    ],
  },
}

export default function InstallGuide({ open, onClose, platform }) {
  const g = STEPS[platform] || STEPS.desktop
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin)
    } catch {
      /* sem permissão */
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={g.title}>
      <div className="install-guide stack">
        <div className="install-hero">
          <img src="/icons/icon-192.png" alt="" width="72" height="72" />
          <p className="small muted">{g.intro}</p>
        </div>
        {g.steps.length > 0 && (
          <ol className="install-steps">
            {g.steps.map((s, i) => (
              <li key={i}>
                <span className="install-num">{i + 1}</span>
                <span className="grow">{s.text}</span>
                {s.icon && (
                  <span className="install-icon" aria-hidden="true">
                    <s.icon size={20} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        {g.note && <p className="tiny muted">{g.note}</p>}
        {(platform === 'in-app' || platform === 'desktop-firefox' || platform === 'ios-other') && (
          <button type="button" className="btn btn-block" onClick={copy}>
            <Copy size={16} /> Copiar endereço do app
          </button>
        )}
        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>Entendi</button>
      </div>
    </Sheet>
  )
}
