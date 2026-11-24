// Edge Function: envia lembretes por Web Push.
// Agendada a cada hora (pg_cron); cada inscrição recebe no horário escolhido
// por ela (preferences.hour), no fuso dela.
//
// Segredos necessários (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ex.: mailto:voce@exemplo.com), CRON_SECRET
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem no ambiente das Edge Functions.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
})

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY'),
  Deno.env.get('VAPID_PRIVATE_KEY'),
)

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)
const pad = (n) => String(n).padStart(2, '0')

function localNow(timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 }
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}
const daysIn = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}
const diffDays = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)
function invoiceDue(card, key) {
  const dueKey = card.due_day > card.closing_day ? key : addMonths(key, 1)
  return `${dueKey}-${pad(Math.min(card.due_day, daysIn(dueKey)))}`
}
const when = (d) => (d === 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias`)

/** Monta as notificações devidas para uma inscrição. Retorna [{ key, title, body, url }] */
async function buildMessages(sub, today, cache) {
  const prefs = { bills: true, invoices: true, budgets: true, daily: false, ...sub.preferences }
  const hid = sub.household_id
  if (!hid) return []

  if (!cache.has(hid)) {
    const month = today.slice(0, 7)
    const [{ data: txs }, { data: cards }, { data: budgets }, { data: cats }] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, type, kind, amount, description, date, paid, card_id, category_id, invoice_month')
        .eq('household_id', hid)
        .gte('date', `${addMonths(month, -2)}-01`)
        .lte('date', addDays(today, 3)),
      supabase.from('credit_cards').select('*').eq('household_id', hid),
      supabase.from('budgets').select('*').eq('household_id', hid),
      supabase.from('categories').select('id, name').eq('household_id', hid),
    ])
    cache.set(hid, { txs: txs || [], cards: cards || [], budgets: budgets || [], cats: new Map((cats || []).map((c) => [c.id, c.name])) })
  }
  const { txs, cards, budgets, cats } = cache.get(hid)
  const out = []

  if (prefs.bills) {
    const due = txs
      .filter((t) => t.type === 'expense' && t.kind === 'normal' && !t.paid && !t.card_id)
      .map((t) => ({ ...t, d: diffDays(today, t.date) }))
      .filter((t) => t.d >= 1 && t.d <= 3)
      .sort((a, b) => a.d - b.d)
    if (due.length) {
      const list = due.slice(0, 3).map((t) => `${t.description || 'Conta'} (${brl(t.amount)}, ${when(t.d)})`).join(', ')
      out.push({
        key: `bills:${today}`,
        title: due.length === 1 ? 'Conta vencendo 📅' : `${due.length} contas vencendo 📅`,
        body: list + (due.length > 3 ? '…' : ''),
        url: '/lancamentos',
      })
    }
  }

  if (prefs.invoices) {
    for (const card of cards) {
      const open = new Map()
      for (const t of txs) {
        if (t.card_id !== card.id || t.kind !== 'normal' || t.paid || !t.invoice_month) continue
        const k = t.invoice_month.slice(0, 7)
        open.set(k, (open.get(k) || 0) + Number(t.amount))
      }
      for (const [k, total] of open) {
        const d = diffDays(today, invoiceDue(card, k))
        if (d >= 0 && d <= 3) {
          out.push({
            key: `invoice:${card.id}:${k}`,
            title: `Fatura do ${card.name} vence ${when(d)}`,
            body: `Valor em aberto: ${brl(total)}. Toque para pagar.`,
            url: '/contas',
          })
        }
      }
    }
  }

  if (prefs.budgets && budgets.length) {
    const month = today.slice(0, 7)
    const spent = new Map()
    for (const t of txs) {
      if (t.type !== 'expense' || t.kind !== 'normal' || !t.date.startsWith(month) || !t.category_id) continue
      spent.set(t.category_id, (spent.get(t.category_id) || 0) + Number(t.amount))
    }
    for (const b of budgets) {
      const ratio = (spent.get(b.category_id) || 0) / Number(b.monthly_limit)
      const name = cats.get(b.category_id) || 'Categoria'
      if (ratio >= 1) {
        out.push({ key: `budget100:${b.category_id}:${month}`, title: `${name}: meta estourada`, body: `Já foram ${brl(spent.get(b.category_id))} de ${brl(b.monthly_limit)} neste mês.`, url: '/metas' })
      } else if (ratio >= 0.8) {
        out.push({ key: `budget80:${b.category_id}:${month}`, title: `${name}: ${Math.round(ratio * 100)}% da meta`, body: `Restam ${brl(b.monthly_limit - spent.get(b.category_id))} para o mês.`, url: '/metas' })
      }
    }
  }

  if (prefs.daily) {
    out.push({ key: `daily:${today}`, title: 'Lançou os gastos de hoje? ✍️', body: 'Leva só um minutinho e mantém o mês em dia.', url: '/?novo=gasto' })
  }
  return out
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('Authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  const force = new URL(req.url).searchParams.get('force') === '1' // ignora o horário (teste)

  const { data: subs, error } = await supabase.from('push_subscriptions').select('*')
  if (error) return new Response(error.message, { status: 500 })

  const cache = new Map()
  let sent = 0
  let removed = 0

  for (const sub of subs || []) {
    const { date, hour } = localNow(sub.timezone || 'America/Sao_Paulo')
    const prefHour = Number(sub.preferences?.hour ?? 9)
    if (!force && hour !== prefHour) continue

    const messages = await buildMessages(sub, date, cache)
    for (const msg of messages) {
      // registra antes de enviar: garante no máximo um envio por chave
      const { error: logErr } = await supabase.from('notification_log').insert({ subscription_id: sub.id, key: msg.key })
      if (logErr) continue // já enviada (23505) ou erro
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          JSON.stringify({ title: msg.title, body: msg.body, url: msg.url, tag: msg.key }),
          { TTL: 60 * 60 * 12 },
        )
        sent++
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          removed++
          break
        }
        await supabase.from('notification_log').delete().eq('subscription_id', sub.id).eq('key', msg.key)
      }
    }
  }

  // limpeza do log antigo
  await supabase.from('notification_log').delete().lt('sent_at', new Date(Date.now() - 90 * 86400000).toISOString())

  return Response.json({ ok: true, sent, removed })
})
