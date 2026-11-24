import { useEffect } from 'react'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import AppRoutes from './routes'
import LockScreen from './components/LockScreen'
import UpdatePrompt from './components/UpdatePrompt'
import SetupNeeded from './pages/SetupNeeded'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { HouseholdProvider } from './context/HouseholdContext'
import { DataProvider } from './context/DataContext'
import { LockProvider, useLock } from './context/LockContext'
import { MonthProvider } from './context/MonthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { InstallProvider } from './context/InstallContext'

/** Bloqueio por PIN por cima de tudo + redirecionamento da recuperação de senha. */
function Shell() {
  const { locked } = useLock()
  const { recovery } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (recovery) navigate('/nova-senha', { replace: true })
  }, [recovery, navigate])

  return (
    <>
      <div aria-hidden={locked || undefined} inert={locked}>
        <AppRoutes />
      </div>
      {locked && <LockScreen />}
      <UpdatePrompt />
    </>
  )
}

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <ThemeProvider>
        <SetupNeeded />
      </ThemeProvider>
    )
  }
  return (
    <ThemeProvider>
      <ToastProvider>
        <InstallProvider>
          <AuthProvider>
            <LockProvider>
              <HouseholdProvider>
                <DataProvider>
                  <MonthProvider>
                    <ConfirmProvider>
                      <BrowserRouter>
                        <Shell />
                      </BrowserRouter>
                    </ConfirmProvider>
                  </MonthProvider>
                </DataProvider>
              </HouseholdProvider>
            </LockProvider>
          </AuthProvider>
        </InstallProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
