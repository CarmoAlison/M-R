// Datas trabalhadas como strings ISO locais ("YYYY-MM-DD") e meses como "YYYY-MM",
// evitando surpresas de fuso horário.

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const pad = (n) => String(n).padStart(2, '0')

export function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO() {
  return toISO(new Date())
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d || 1)
}

export function monthKey(isoOrDate = new Date()) {
  if (typeof isoOrDate === 'string') return isoOrDate.slice(0, 7)
  return `${isoOrDate.getFullYear()}-${pad(isoOrDate.getMonth() + 1)}`
}

export function currentMonth() {
  return monthKey(new Date())
}

export function daysInMonth(key) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return monthKey(d)
}

/** Soma meses a uma data, mantendo o dia (limitado ao fim do mês). */
export function addMonthsToDate(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const key = addMonths(`${y}-${pad(m)}`, n)
  const day = Math.min(d, daysInMonth(key))
  return `${key}-${pad(day)}`
}

export function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function dateInMonth(key, day) {
  return `${key}-${pad(Math.min(day, daysInMonth(key)))}`
}

export function diffDays(fromISO, toISOStr) {
  return Math.round((parseISO(toISOStr) - parseISO(fromISO)) / 86400000)
}

export function monthLabel(key, { short = false, withYear = true } = {}) {
  const [y, m] = key.split('-').map(Number)
  const name = short ? MONTHS[m - 1].slice(0, 3) : MONTHS[m - 1]
  return withYear ? `${name} ${short ? String(y).slice(2) : y}` : name
}

export function monthName(key) {
  return MONTHS[Number(key.split('-')[1]) - 1].toLowerCase()
}

export function weekdayName(index) {
  return WEEKDAYS[index]
}

export function formatDate(iso, opts = { day: '2-digit', month: 'short' }) {
  return parseISO(iso).toLocaleDateString('pt-BR', opts).replace('.', '')
}

export function formatDayHeader(iso) {
  const today = todayISO()
  if (iso === today) return 'Hoje'
  if (iso === addDays(today, -1)) return 'Ontem'
  if (iso === addDays(today, 1)) return 'Amanhã'
  const label = parseISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Lista de meses entre dois meses (inclusive). */
export function monthRange(from, to) {
  const out = []
  let k = from
  while (k <= to && out.length < 120) {
    out.push(k)
    k = addMonths(k, 1)
  }
  return out
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Boa noite'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}
