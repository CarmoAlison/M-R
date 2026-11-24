// Dados de exemplo para a prévia visual (somente desenvolvimento).
import { addMonths, currentMonth, dateInMonth } from '../lib/dates'

const ME = 'u-ryan'
const HER = 'u-maria'
let seq = 0
const id = (p) => `${p}-${++seq}`

export const members = [
  { user_id: ME, role: 'admin', joined_at: '2026-05-02T10:00:00Z', profiles: { id: ME, name: 'Ryan Alison', avatar_url: null } },
  { user_id: HER, role: 'member', joined_at: '2026-05-03T10:00:00Z', profiles: { id: HER, name: 'Maria Souza', avatar_url: null } },
]

const cat = (name, type, icon, color) => ({ id: id('cat'), name, type, icon, color, archived: false, household_id: 'h1' })
export const categories = [
  cat('Moradia', 'expense', 'house', '#A48374'),
  cat('Mercado', 'expense', 'shopping-cart', '#7E8F6F'),
  cat('Transporte', 'expense', 'car', '#C29A5B'),
  cat('Saúde', 'expense', 'heart-pulse', '#B5675B'),
  cat('Lazer', 'expense', 'gamepad-2', '#8E7A8A'),
  cat('Educação', 'expense', 'graduation-cap', '#6F8584'),
  cat('Restaurantes', 'expense', 'utensils', '#C08A6B'),
  cat('Assinaturas', 'expense', 'tv', '#9A7B6C'),
  cat('Outros', 'expense', 'ellipsis', '#A39B92'),
  cat('Salário', 'income', 'briefcase', '#7E8F6F'),
  cat('Extra', 'income', 'sparkles', '#C29A5B'),
  cat('Investimentos', 'income', 'trending-up', '#6F8584'),
  cat('Outros', 'income', 'ellipsis', '#A39B92'),
]
const C = Object.fromEntries(categories.map((c) => [`${c.type}:${c.name}`, c.id]))

export const accounts = [
  { id: 'acc-1', name: 'Nubank Conta', type: 'checking', initial_balance: 2350, color: '#A48374', household_id: 'h1' },
  { id: 'acc-2', name: 'Poupança', type: 'savings', initial_balance: 8000, color: '#7E8F6F', household_id: 'h1' },
  { id: 'acc-3', name: 'Carteira', type: 'wallet', initial_balance: 120, color: '#C29A5B', household_id: 'h1' },
]
export const cards = [
  { id: 'card-1', name: 'Nubank', credit_limit: 6000, closing_day: 5, due_day: 12, payment_account_id: 'acc-1', color: '#8E7A8A', household_id: 'h1' },
  { id: 'card-2', name: 'Itaú Click', credit_limit: 3500, closing_day: 25, due_day: 5, payment_account_id: 'acc-1', color: '#6F8584', household_id: 'h1' },
]

function invoiceMonth(date, card) {
  const day = Number(date.slice(8, 10))
  const key = date.slice(0, 7)
  return `${day > card.closing_day ? addMonths(key, 1) : key}-01`
}

const tx = (o) => ({
  id: id('tx'),
  household_id: 'h1',
  kind: 'normal',
  paid: true,
  user_id: ME,
  paid_by: o.paid_by || o.user_id || ME,
  shared: true,
  account_id: o.card_id ? null : 'acc-1',
  card_id: null,
  recurring_id: null,
  installment_group_id: null,
  installment_number: null,
  installment_total: null,
  receipt_path: null,
  created_at: new Date().toISOString(),
  ...o,
  invoice_month: o.card_id ? invoiceMonth(o.date, cards.find((c) => c.id === o.card_id)) : null,
})

const now = currentMonth()
const today = new Date().getDate()
export const transactions = []
for (let i = 5; i >= 0; i--) {
  const m = addMonths(now, -i)
  const isCur = i === 0
  const d = (day) => dateInMonth(m, day)
  const upTo = (day) => !isCur || day <= today
  transactions.push(tx({ type: 'income', amount: 6200, description: 'Salário Ryan', date: d(5), category_id: C['income:Salário'], recurring_id: 'r1' }))
  transactions.push(tx({ type: 'income', amount: 4800, description: 'Salário Maria', date: d(5), category_id: C['income:Salário'], user_id: HER, recurring_id: 'r2' }))
  if (i % 2 === 0) transactions.push(tx({ type: 'income', amount: 650, description: 'Freela design', date: d(18), category_id: C['income:Extra'], paid: upTo(18) }))
  transactions.push(tx({ type: 'expense', amount: 2400, description: 'Aluguel', date: d(10), category_id: C['expense:Moradia'], recurring_id: 'r3', paid: upTo(10) || !isCur }))
  transactions.push(tx({ type: 'expense', amount: 189.9, description: 'Internet + celular', date: d(28), category_id: C['expense:Moradia'], recurring_id: 'r4', paid: !isCur }))
  transactions.push(tx({ type: 'expense', amount: 55.9, description: 'Netflix', date: d(15), category_id: C['expense:Assinaturas'], card_id: 'card-1', paid: !isCur && i > 1 }))
  transactions.push(tx({ type: 'expense', amount: 21.9, description: 'Spotify', date: d(7), category_id: C['expense:Assinaturas'], card_id: 'card-1', paid: !isCur && i > 1 }))
  const markets = [3, 9, 16, 23]
  markets.forEach((day, k) => {
    if (upTo(day)) transactions.push(tx({ type: 'expense', amount: 280 + ((i * 37 + k * 53) % 190), description: k % 2 ? 'Feira da semana' : 'Supermercado Assaí', date: d(day), category_id: C['expense:Mercado'], user_id: k % 2 ? HER : ME, paid_by: k % 2 ? HER : ME }))
  })
  if (upTo(12)) transactions.push(tx({ type: 'expense', amount: 92 + i * 8, description: 'Uber', date: d(12), category_id: C['expense:Transporte'], card_id: 'card-2', paid: !isCur && i > 1 }))
  if (upTo(14)) transactions.push(tx({ type: 'expense', amount: 230, description: 'Combustível', date: d(14), category_id: C['expense:Transporte'], user_id: HER, paid_by: HER }))
  if (upTo(20)) transactions.push(tx({ type: 'expense', amount: 140 + i * 15, description: 'Jantar fora', date: d(20), category_id: C['expense:Restaurantes'], card_id: 'card-1', paid: !isCur && i > 1 }))
  if (upTo(21)) transactions.push(tx({ type: 'expense', amount: 68.5, description: 'Farmácia', date: d(21), category_id: C['expense:Saúde'], user_id: HER, paid_by: HER, shared: false }))
  if (upTo(8)) transactions.push(tx({ type: 'expense', amount: 450, description: 'Curso de inglês', date: d(8), category_id: C['expense:Educação'] }))
  if (i % 2 && upTo(25)) transactions.push(tx({ type: 'expense', amount: 180, description: 'Cinema e pipoca', date: d(25), category_id: C['expense:Lazer'], user_id: HER, paid_by: HER }))
}
// parcelado: geladeira em 10x no cartão
for (let k = 0; k < 10; k++) {
  const m = addMonths(now, k - 3)
  transactions.push(tx({ type: 'expense', amount: 389.9, description: 'Geladeira', date: dateInMonth(m, 2), category_id: C['expense:Moradia'], card_id: 'card-1', paid: k < 2, installment_group_id: 'g1', installment_number: k + 1, installment_total: 10 }))
}
transactions.sort((a, b) => b.date.localeCompare(a.date))

export const budgets = [
  { id: 'b1', household_id: 'h1', category_id: C['expense:Mercado'], monthly_limit: 1500 },
  { id: 'b2', household_id: 'h1', category_id: C['expense:Restaurantes'], monthly_limit: 200 },
  { id: 'b3', household_id: 'h1', category_id: C['expense:Transporte'], monthly_limit: 400 },
]

export const rules = [
  { id: 'r3', household_id: 'h1', type: 'expense', amount: 2400, description: 'Aluguel', category_id: C['expense:Moradia'], account_id: 'acc-1', card_id: null, day_of_month: 10, active: true, start_date: '2026-01-10', end_date: null },
  { id: 'r4', household_id: 'h1', type: 'expense', amount: 189.9, description: 'Internet + celular', category_id: C['expense:Moradia'], account_id: 'acc-1', card_id: null, day_of_month: 28, active: true, start_date: '2026-01-28', end_date: null },
  { id: 'r1', household_id: 'h1', type: 'income', amount: 6200, description: 'Salário Ryan', category_id: C['income:Salário'], account_id: 'acc-1', card_id: null, day_of_month: 5, active: true, start_date: '2026-01-05', end_date: null },
]

export const goals = [
  { id: 'goal-1', household_id: 'h1', name: 'Reserva de emergência', target_amount: 30000, target_date: '2027-12-31', icon: 'piggy-bank', color: '#7E8F6F', archived: false },
  { id: 'goal-2', household_id: 'h1', name: 'Viagem para Gramado', target_amount: 8000, target_date: '2027-06-30', icon: 'plane', color: '#C29A5B', archived: false },
  { id: 'goal-3', household_id: 'h1', name: 'Carro novo', target_amount: 45000, target_date: null, icon: 'car', color: '#6F8584', archived: false },
]
export const goalEntries = [
  { id: 'ge1', household_id: 'h1', goal_id: 'goal-1', user_id: ME, amount: 9000, date: '2026-06-10', note: 'Começo' },
  { id: 'ge2', household_id: 'h1', goal_id: 'goal-1', user_id: HER, amount: 3500, date: '2026-10-10', note: '' },
  { id: 'ge3', household_id: 'h1', goal_id: 'goal-2', user_id: HER, amount: 2400, date: '2026-09-05', note: '13º adiantado' },
  { id: 'ge4', household_id: 'h1', goal_id: 'goal-3', user_id: ME, amount: 5000, date: '2026-08-01', note: '' },
]
export const settlements = [{ id: 's1', household_id: 'h1', from_user: HER, to_user: ME, amount: 300, date: '2026-10-30', note: 'Pix' }]

export const user = { id: ME, email: 'ryan@exemplo.com', created_at: '2026-05-02T10:00:00Z', user_metadata: { name: 'Ryan Alison' } }
export const profile = { id: ME, name: 'Ryan Alison', avatar_url: null }
export const household = { id: 'h1', name: 'Maria e Ryan', created_by: ME }
