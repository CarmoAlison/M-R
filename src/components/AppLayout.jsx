import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { CloudUpload, WifiOff } from 'lucide-react'
import BottomNav from './BottomNav'
import Sidebar from './Sidebar'
import QuickAdd from './QuickAdd'
import { useData } from '../context/DataContext'
import { QuickAddContext } from '../context/QuickAddContext'
import './AppLayout.css'

export default function AppLayout() {
  const [adding, setAdding] = useState(null) // null | 'expense' | 'income'
  const { online, pending } = useData()
  const { pathname } = useLocation()
  const quickAdd = useMemo(() => ({ open: (type = 'expense') => setAdding(type) }), [])
  const [params, setParams] = useSearchParams()

  // atalhos do app instalado / notificações: /?novo=gasto | /?novo=ganho
  useEffect(() => {
    const novo = params.get('novo')
    if (!novo) return
    setAdding(novo === 'ganho' ? 'income' : 'expense')
    const next = new URLSearchParams(params)
    next.delete('novo')
    setParams(next, { replace: true })
  }, [params, setParams])

  return (
    <QuickAddContext.Provider value={quickAdd}>
      <div className="app-shell">
        <Sidebar onAdd={() => setAdding('expense')} />
        <div className="app-content">
          {(!online || pending > 0) && (
            <div className={`offline-banner ${online ? 'is-syncing' : ''}`} role="status">
              {online ? <CloudUpload size={16} /> : <WifiOff size={16} />}
              {online
                ? `Sincronizando ${pending} ${pending === 1 ? 'alteração' : 'alterações'}…`
                : `Você está offline${pending ? ` · ${pending} ${pending === 1 ? 'alteração' : 'alterações'} na fila` : ''}`}
            </div>
          )}
          <main key={pathname} className="app-main fade-in">
            <Outlet />
          </main>
        </div>
        <BottomNav onAdd={() => setAdding('expense')} />
        <QuickAdd open={Boolean(adding)} initialType={adding || 'expense'} onClose={() => setAdding(null)} />
      </div>
    </QuickAddContext.Provider>
  )
}
