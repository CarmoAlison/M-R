// Fila de operações feitas offline, persistida no localStorage e
// reenviada em ordem quando a conexão volta.
import { supabase } from './supabaseClient'

const KEY = 'cf-offline-queue'
const listeners = new Set()

export function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

function writeQueue(q) {
  localStorage.setItem(KEY, JSON.stringify(q))
  listeners.forEach((fn) => fn(q.length))
}

export function enqueue(op) {
  writeQueue([...readQueue(), { ...op, queuedAt: Date.now() }])
}

export function onQueueChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Executa uma operação contra o Supabase. Lança o erro em caso de falha. */
export async function runOp(op) {
  let res
  if (op.op === 'insert') res = await supabase.from(op.table).insert(op.rows)
  else if (op.op === 'upsert') res = await supabase.from(op.table).upsert(op.rows, op.options)
  else if (op.op === 'update') res = await supabase.from(op.table).update(op.patch).in('id', op.ids)
  else if (op.op === 'delete') res = await supabase.from(op.table).delete().in('id', op.ids)
  else if (op.op === 'rpc') res = await supabase.rpc(op.fn, op.args)
  if (res?.error) throw res.error
  return res?.data
}

let flushing = false
/**
 * Reenvia a fila. Erros de rede interrompem (tenta depois);
 * erros do servidor (ex.: RLS) descartam a operação e são reportados.
 */
export async function flushQueue({ onError } = {}) {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let done = 0
  try {
    let q = readQueue()
    while (q.length) {
      const [op, ...rest] = q
      try {
        await runOp(op)
        done++
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase()
        if (err?.name === 'TypeError' || msg.includes('fetch')) break
        // conflito de chave: a operação já tinha sido aplicada
        if (err?.code !== '23505') onError?.(err, op)
      }
      q = rest
      writeQueue(q)
    }
  } finally {
    flushing = false
  }
  return done
}
