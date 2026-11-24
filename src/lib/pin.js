// PIN guardado APENAS no dispositivo: hash PBKDF2-SHA256 + salt aleatório (WebCrypto).
const ITERATIONS = 210000
const storeKey = (userId) => `cf-pin-${userId}`

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
}

export function getPinRecord(userId) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(userId)))
  } catch {
    return null
  }
}

export const hasPin = (userId) => Boolean(userId && getPinRecord(userId)?.hash)

export async function setPin(userId, pin, lockAfterMinutes = 1) {
  if (!/^\d{4,6}$/.test(pin)) throw new Error('O PIN deve ter de 4 a 6 dígitos.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, ITERATIONS)
  const record = {
    hash: toB64(hash),
    salt: toB64(salt),
    iterations: ITERATIONS,
    length: pin.length,
    lockAfterMinutes,
    failed: 0,
    lockedUntil: 0,
  }
  localStorage.setItem(storeKey(userId), JSON.stringify(record))
}

export function updatePinSettings(userId, patch) {
  const rec = getPinRecord(userId)
  if (rec) localStorage.setItem(storeKey(userId), JSON.stringify({ ...rec, ...patch }))
}

export function clearPin(userId) {
  localStorage.removeItem(storeKey(userId))
}

/** Compara em tempo constante. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const MAX_ATTEMPTS = 5

/**
 * Verifica o PIN. Retorna { ok, remaining, lockedUntil }.
 * Após 5 erros, bloqueia por 30s, dobrando a cada novo bloqueio (máx. 15 min).
 */
export async function verifyPin(userId, pin) {
  const rec = getPinRecord(userId)
  if (!rec) return { ok: true }
  if (rec.lockedUntil > Date.now()) return { ok: false, lockedUntil: rec.lockedUntil, remaining: 0 }

  const hash = toB64(await derive(pin, fromB64(rec.salt), rec.iterations))
  if (safeEqual(hash, rec.hash)) {
    updatePinSettings(userId, { failed: 0, lockedUntil: 0, lockouts: 0 })
    return { ok: true }
  }
  const failed = (rec.failed || 0) + 1
  if (failed >= MAX_ATTEMPTS) {
    const lockouts = (rec.lockouts || 0) + 1
    const lockedUntil = Date.now() + Math.min(30000 * 2 ** (lockouts - 1), 15 * 60000)
    updatePinSettings(userId, { failed: 0, lockedUntil, lockouts })
    return { ok: false, lockedUntil, remaining: 0 }
  }
  updatePinSettings(userId, { failed })
  return { ok: false, remaining: MAX_ATTEMPTS - failed }
}
