import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { useAuth } from './context/AuthContext'
import { useHousehold } from './context/HouseholdContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'

// páginas secundárias carregadas sob demanda
const Lancamentos = lazy(() => import('./pages/Lancamentos'))
const Objetivos = lazy(() => import('./pages/Objetivos'))
const Divisao = lazy(() => import('./pages/Divisao'))
const Importar = lazy(() => import('./pages/Importar'))
const Relatorio = lazy(() => import('./pages/Relatorio'))
const Contas = lazy(() => import('./pages/Contas'))
const Metas = lazy(() => import('./pages/Metas'))
const Recorrentes = lazy(() => import('./pages/Recorrentes'))
const Familia = lazy(() => import('./pages/Familia'))
const Config = lazy(() => import('./pages/Config'))
const Mais = lazy(() => import('./pages/Mais'))
const Perfil = lazy(() => import('./pages/Perfil'))
const Cadastro = lazy(() => import('./pages/Cadastro'))
const RecuperarSenha = lazy(() => import('./pages/RecuperarSenha'))
const NovaSenha = lazy(() => import('./pages/NovaSenha'))
const Onboarding = lazy(() => import('./pages/Onboarding'))

export function Splash() {
  return (
    <div className="center-screen" aria-busy="true" aria-label="Carregando">
      <div className="spinner" />
    </div>
  )
}

/** Exige login e uma casa (senão manda para o onboarding). */
function PrivateRoute({ requireHousehold = true }) {
  const { session, loading } = useAuth()
  const { householdId, loading: hhLoading } = useHousehold()
  const location = useLocation()
  if (loading || (session && hhLoading)) return <Splash />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (requireHousehold && !householdId) return <Navigate to={`/onboarding${location.search}`} replace />
  return <Outlet />
}

function PublicOnly() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (session) return <Navigate to={location.state?.from || '/'} replace />
  return <Outlet />
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        </Route>
        <Route path="/nova-senha" element={<NovaSenha />} />

        <Route element={<PrivateRoute requireHousehold={false} />}>
          <Route path="/onboarding" element={<Onboarding />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lancamentos" element={<Lancamentos />} />
            <Route path="/objetivos" element={<Objetivos />} />
            <Route path="/divisao" element={<Divisao />} />
            <Route path="/importar" element={<Importar />} />
            {/* endereços antigos */}
            <Route path="/ganhos" element={<Navigate to="/lancamentos?tipo=income" replace />} />
            <Route path="/gastos" element={<Navigate to="/lancamentos" replace />} />
            <Route path="/controle" element={<Navigate to="/lancamentos" replace />} />
            <Route path="/relatorio" element={<Relatorio />} />
            <Route path="/contas" element={<Contas />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/recorrentes" element={<Recorrentes />} />
            <Route path="/familia" element={<Familia />} />
            <Route path="/config" element={<Config />} />
            <Route path="/mais" element={<Mais />} />
            <Route path="/perfil" element={<Perfil />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
