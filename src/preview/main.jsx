// Prévia visual com dados de exemplo — só para desenvolvimento (npm run dev → /preview.html?rota=/relatorio&tema=dark)
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../styles/global.css'
import '../styles/theme.css'
import '../styles/animations.css'
import AppRoutes from '../routes'
import { ThemeProvider } from '../context/ThemeContext'
import { ToastProvider } from '../context/ToastContext'
import { InstallProvider } from '../context/InstallContext'
import { AuthContext } from '../context/AuthContext'
import { HouseholdContext } from '../context/HouseholdContext'
import { DataContext } from '../context/DataContext'
import { LockProvider } from '../context/LockContext'
import { MonthProvider } from '../context/MonthContext'
import { ConfirmProvider } from '../context/ConfirmContext'
import * as m from './mockData'

const params = new URLSearchParams(location.search)
localStorage.setItem('cf-theme', params.get('tema') === 'dark' ? 'dark' : 'light')
document.documentElement.setAttribute('data-theme', params.get('tema') === 'dark' ? 'dark' : 'light')
if (params.get('sem-animacao')) {
  const st = document.createElement('style')
  st.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important}'
  document.head.appendChild(st)
}

const noop = async () => ({})
const auth = {
  session: { user: m.user },
  user: m.user,
  profile: m.profile,
  loading: false,
  recovery: false,
  signIn: noop,
  signUp: noop,
  signOut: noop,
  resetPassword: noop,
  updatePassword: noop,
  updateProfile: noop,
}
const household = {
  loading: false,
  memberships: [{ household_id: 'h1', role: 'admin', households: m.household }],
  household: m.household,
  householdId: 'h1',
  role: 'admin',
  isAdmin: true,
  members: m.members,
  memberById: new Map(m.members.map((x) => [x.user_id, x])),
  refresh: noop,
  refreshMembers: noop,
  createHousehold: noop,
  joinByCode: noop,
  switchHousehold: () => {},
}
const data = {
  insert: noop,
  upsert: noop,
  update: noop,
  remove: noop,
  rpc: noop,
  refetch: noop,
  reload: noop,
  loading: false,
  online: true,
  pending: 0,
  transactions: m.transactions,
  accounts: m.accounts,
  cards: m.cards,
  categories: m.categories,
  budgets: m.budgets,
  rules: m.rules,
  goals: m.goals,
  goalEntries: m.goalEntries,
  settlements: m.settlements,
}

createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <ToastProvider>
      <InstallProvider>
        <AuthContext.Provider value={auth}>
          <LockProvider>
            <HouseholdContext.Provider value={household}>
              <DataContext.Provider value={data}>
                <MonthProvider>
                  <ConfirmProvider>
                    <MemoryRouter initialEntries={[params.get('rota') || '/']}>
                      <AppRoutes />
                    </MemoryRouter>
                  </ConfirmProvider>
                </MonthProvider>
              </DataContext.Provider>
            </HouseholdContext.Provider>
          </LockProvider>
        </AuthContext.Provider>
      </InstallProvider>
    </ToastProvider>
  </ThemeProvider>,
)
