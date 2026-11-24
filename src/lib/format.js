const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brlCompact = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const pctFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function brl(value) {
  return brlFormatter.format(Number(value) || 0)
}

export function brlShort(value) {
  const n = Number(value) || 0
  return Math.abs(n) >= 10000 ? brlCompact.format(n) : brl(n)
}

/** R$ sem centavos quando inteiro — para frases dos insights. */
export function brlSoft(value) {
  const n = Math.round(Number(value) || 0)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
}

export function pct(value) {
  return `${pctFormatter.format(value)}%`
}

export function signedPct(value) {
  const n = Math.round(value)
  return `${n > 0 ? '+' : ''}${n}%`
}

/** Centavos (inteiro) -> número em reais */
export const centsToNumber = (cents) => Math.round(cents) / 100
export const numberToCents = (n) => Math.round((Number(n) || 0) * 100)

/** Soma segura de valores monetários (evita erro de ponto flutuante). */
export function sum(list, pick = (x) => x) {
  return list.reduce((acc, item) => acc + numberToCents(pick(item)), 0) / 100
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] || ''
}

const AVATAR_COLORS = ['#A48374', '#6F8F72', '#C9A15B', '#B5675B', '#8C7AA8', '#5E8A9A', '#C7835E']
export function avatarColor(id = '') {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16),
  )
}
