// Web Push (VAPID). A chave pública vem do .env; a privada fica só na Edge Function.
import { supabase } from './supabaseClient'

export const DEFAULT_PREFS = { bills: true, invoices: true, budgets: true, daily: false, hour: 9 }

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export function pushSupport() {
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-install' }
    return { ok: false, reason: 'unsupported' }
  }
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'ios-install' }
  if (!vapid) return { ok: false, reason: 'no-vapid' }
  return { ok: true }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) throw new Error('O app precisa estar instalado/carregado com o service worker ativo (rode o build de produção).')
  return reg
}

export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function loadPushPreferences() {
  const sub = await getCurrentSubscription()
  if (!sub) return null
  const { data } = await supabase.from('push_subscriptions').select('preferences').eq('endpoint', sub.endpoint).maybeSingle()
  return data ? { ...DEFAULT_PREFS, ...data.preferences } : null
}

export async function subscribePush(householdId, preferences = DEFAULT_PREFS) {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permissão de notificação negada. Você pode liberar nas configurações do navegador.')
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    })
  }
  const json = sub.toJSON()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      household_id: householdId,
      endpoint: json.endpoint,
      keys: json.keys,
      preferences,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
  return sub
}

export async function savePushPreferences(preferences) {
  const sub = await getCurrentSubscription()
  if (!sub) return
  const { error } = await supabase.from('push_subscriptions').update({ preferences }).eq('endpoint', sub.endpoint)
  if (error) throw error
}

export async function unsubscribePush() {
  const sub = await getCurrentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
