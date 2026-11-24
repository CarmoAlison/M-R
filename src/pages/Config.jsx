import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, ChevronRight, Download, Lock, LogOut, Monitor, Moon, Palette, Smartphone, Sun, Tags } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import PinPad from '../components/PinPad'
import CategoryManager from '../components/CategoryManager'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLock } from '../context/LockContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { useInstall } from '../context/InstallContext'
import { useHousehold } from '../context/HouseholdContext'
import { clearPin, setPin, updatePinSettings } from '../lib/pin'
import { DEFAULT_PREFS, loadPushPreferences, pushSupport, savePushPreferences, subscribePush, unsubscribePush } from '../lib/push'
import { friendlyError } from '../lib/errors'
import './Config.css'

const LOCK_OPTIONS = [
  [0, 'Imediatamente'],
  [1, 'Após 1 minuto'],
  [5, 'Após 5 minutos'],
  [15, 'Após 15 minutos'],
  [60, 'Após 1 hora'],
]

const NOTIFS = [
  ['bills', 'Contas vencendo', 'Avisa 1 a 3 dias antes do vencimento'],
  ['invoices', 'Fatura do cartão', 'Avisa quando a fatura está para vencer'],
  ['budgets', 'Metas', 'Quando uma categoria chegar a 80% e 100%'],
  ['daily', 'Lembrete diário', 'Lembra de lançar os gastos do dia'],
]

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card stack config-section">
      <h2 className="config-title">
        <Icon size={18} aria-hidden="true" /> {title}
      </h2>
      {children}
    </section>
  )
}

export default function Config() {
  const { user, profile, signOut } = useAuth()
  const { mode, setMode } = useTheme()
  const lock = useLock()
  const toast = useToast()
  const confirm = useConfirm()
  const { canInstall, installed, install } = useInstall()
  const { householdId } = useHousehold()
  const [pinStep, setPinStep] = useState(null) // 'new' | 'confirm'
  const [firstPin, setFirstPin] = useState('')
  const [pinError, setPinError] = useState(0)
  const [push, setPush] = useState({ loading: true, enabled: false, prefs: DEFAULT_PREFS })
  const [cats, setCats] = useState(false)
  const support = pushSupport()

  useEffect(() => {
    if (!support.ok) return setPush((p) => ({ ...p, loading: false }))
    loadPushPreferences()
      .then((prefs) => setPush({ loading: false, enabled: Boolean(prefs), prefs: prefs || DEFAULT_PREFS }))
      .catch(() => setPush((p) => ({ ...p, loading: false })))
  }, [support.ok])

  const onPin = async (pin) => {
    if (pinStep === 'new') {
      setFirstPin(pin)
      setPinStep('confirm')
      return
    }
    if (pin !== firstPin) {
      setPinError((n) => n + 1)
      toast.error('Os PINs não conferem. Comece de novo.')
      setPinStep('new')
      return
    }
    try {
      await setPin(user.id, pin, lock.pinRecord?.lockAfterMinutes ?? 1)
      lock.refresh()
      setPinStep(null)
      toast.success('PIN definido 🔒')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const removePin = async () => {
    const ok = await confirm({ title: 'Remover PIN?', message: 'O app deixará de pedir PIN ao abrir neste aparelho.', confirmLabel: 'Remover', tone: 'danger' })
    if (!ok) return
    clearPin(user.id)
    lock.refresh()
    toast.success('PIN removido')
  }

  const togglePush = async (on) => {
    setPush((p) => ({ ...p, loading: true }))
    try {
      if (on) await subscribePush(householdId, push.prefs)
      else await unsubscribePush()
      setPush((p) => ({ ...p, loading: false, enabled: on }))
      toast.success(on ? 'Notificações ativadas' : 'Notificações desativadas')
    } catch (err) {
      setPush((p) => ({ ...p, loading: false }))
      toast.error(friendlyError(err))
    }
  }

  const setPref = async (patch) => {
    const prefs = { ...push.prefs, ...patch }
    setPush((p) => ({ ...p, prefs }))
    try {
      await savePushPreferences(prefs)
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }

  const logout = async () => {
    const ok = await confirm({ title: 'Sair da conta?', message: 'Os dados ficam salvos na nuvem. Lançamentos offline ainda não sincronizados serão perdidos.', confirmLabel: 'Sair', tone: 'danger' })
    if (ok) await signOut()
  }

  return (
    <div className="page page--narrow">
      <PageHeader title="Configurações" back />

      <Link to="/perfil" className="card config-profile">
        <Avatar id={user?.id} name={profile?.name || user?.email} src={profile?.avatar_url} size={48} />
        <span className="grow">
          <span className="strong block">{profile?.name}</span>
          <span className="tiny muted">Foto, nome, e-mail e senha</span>
        </span>
        <ChevronRight size={18} className="muted" />
      </Link>

      <Section icon={Palette} title="Aparência">
        <div className="segmented" role="group" aria-label="Tema">
          <button type="button" aria-pressed={mode === 'light'} onClick={() => setMode('light')}><Sun size={16} /> Claro</button>
          <button type="button" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}><Moon size={16} /> Escuro</button>
          <button type="button" aria-pressed={mode === 'system'} onClick={() => setMode('system')}><Monitor size={16} /> Sistema</button>
        </div>
        <p className="tiny muted">“Sistema” acompanha o modo claro/escuro do seu aparelho.</p>
      </Section>

      <Section icon={Lock} title="Bloqueio por PIN">
        <p className="small muted">O PIN fica guardado só neste aparelho (criptografado) e é pedido ao abrir o app.</p>
        {lock.pinEnabled ? (
          <>
            <label className="field">
              <span>Bloquear quando ficar em segundo plano</span>
              <select
                className="select"
                value={lock.pinRecord?.lockAfterMinutes ?? 1}
                onChange={(e) => {
                  updatePinSettings(user.id, { lockAfterMinutes: Number(e.target.value) })
                  lock.refresh()
                  toast.success('Preferência salva')
                }}
              >
                {LOCK_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div className="grid-2">
              <button type="button" className="btn" onClick={() => setPinStep('new')}>Trocar PIN</button>
              <button type="button" className="btn btn-danger" onClick={removePin}>Remover</button>
            </div>
          </>
        ) : (
          <button type="button" className="btn btn-primary btn-block" onClick={() => setPinStep('new')}>Definir PIN</button>
        )}
      </Section>

      <Section icon={Bell} title="Notificações">
        {support.reason === 'ios-install' ? (
          <div className="banner banner--info">
            <Smartphone size={20} />
            <span>No iPhone, as notificações só funcionam com o app instalado: toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong> e abra por lá.</span>
          </div>
        ) : support.reason === 'unsupported' ? (
          <p className="small muted">Este navegador não suporta notificações push.</p>
        ) : support.reason === 'no-vapid' ? (
          <p className="small muted">Notificações ainda não configuradas (falta a chave VAPID no .env — veja o README).</p>
        ) : (
          <>
            <label className="switch">
              <span>Receber notificações neste aparelho</span>
              <input type="checkbox" checked={push.enabled} disabled={push.loading} onChange={(e) => togglePush(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
            </label>
            {push.enabled && (
              <div className="stack-sm fade-in">
                {NOTIFS.map(([key, label, hint]) => (
                  <label key={key} className="switch">
                    <span>
                      {label}
                      <small className="block muted">{hint}</small>
                    </span>
                    <input type="checkbox" checked={Boolean(push.prefs[key])} onChange={(e) => setPref({ [key]: e.target.checked })} />
                    <span className="switch-track" aria-hidden="true" />
                  </label>
                ))}
                <label className="field">
                  <span>Horário dos avisos</span>
                  <select className="select" value={push.prefs.hour} onChange={(e) => setPref({ hour: Number(e.target.value) })}>
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </>
        )}
      </Section>

      <Section icon={Tags} title="Categorias">
        <p className="small muted">Crie, edite ou arquive categorias de ganhos e gastos.</p>
        <button type="button" className="btn btn-block" onClick={() => setCats(true)}>Gerenciar categorias</button>
      </Section>

      {(canInstall || !installed) && (
        <Section icon={Download} title="Instalar app">
          {canInstall ? (
            <button type="button" className="btn btn-primary btn-block" onClick={install}>Instalar na tela inicial</button>
          ) : (
            <p className="small muted">Use o menu do navegador → “Instalar app” ou “Adicionar à tela inicial”.</p>
          )}
        </Section>
      )}

      <button type="button" className="btn btn-danger btn-block" onClick={logout}>
        <LogOut size={18} /> Sair da conta
      </button>
      <p className="tiny muted" style={{ textAlign: 'center' }}>M&amp;R Controle Financeiro · versão {__APP_VERSION__}</p>

      <Sheet open={Boolean(pinStep)} onClose={() => setPinStep(null)} title={pinStep === 'confirm' ? 'Confirme o PIN' : 'Novo PIN'}>
        <div className="pin-sheet">
          <PinPad
            key={pinStep}
            allowVariable={pinStep === 'new'}
            length={pinStep === 'confirm' ? firstPin.length : 4}
            onComplete={onPin}
            error={pinError}
            label={pinStep === 'confirm' ? 'Digite novamente' : 'Escolha de 4 a 6 dígitos e toque em OK'}
          />
        </div>
      </Sheet>

      <Sheet open={cats} onClose={() => setCats(false)} title="Categorias" size="full">
        <CategoryManager />
      </Sheet>
    </div>
  )
}
