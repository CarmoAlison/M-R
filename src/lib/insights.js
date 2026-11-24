// Insights automáticos — frases curtas e gentis calculadas no cliente.
import { addMonths, currentMonth, daysInMonth, monthName, parseISO, weekdayName } from './dates'
import { brlSoft } from './format'
import { budgetProgress, byCategory, cardInvoices, cardUsed, isNormal, totals, txInMonth } from './finance'

export function buildInsights({ transactions, categories, budgets, cards, month }) {
  const out = []
  const prevKey = addMonths(month, -1)
  const cur = txInMonth(transactions, month)
  const prev = txInMonth(transactions, prevKey)
  const curTotals = totals(cur)
  const prevTotals = totals(prev)
  const isCurrent = month === currentMonth()

  // 1) Projeção de fechamento (somente no mês corrente)
  if (isCurrent && (curTotals.income > 0 || curTotals.expense > 0)) {
    const today = new Date().getDate()
    const dim = daysInMonth(month)
    // gastos variáveis já feitos projetados pelo ritmo + fixos/futuros já lançados
    const todayStr = `${month}-${String(today).padStart(2, '0')}`
    const doneVariable = cur
      .filter((t) => t.type === 'expense' && isNormal(t) && t.date <= todayStr && !t.recurring_id && !t.installment_group_id)
      .reduce((a, t) => a + Number(t.amount), 0)
    const committed = curTotals.expense - doneVariable
    const projectedExpense = committed + (doneVariable / Math.max(today, 1)) * dim
    const left = curTotals.income - projectedExpense
    out.push(
      left >= 0
        ? { id: 'projection', tone: 'good', icon: 'trending-up', text: `No ritmo atual, vocês terminam o mês com ${brlSoft(left)} de sobra.` }
        : { id: 'projection', tone: 'warn', icon: 'trending-down', text: `No ritmo atual, o mês pode fechar ${brlSoft(-left)} no vermelho. Dá tempo de ajustar!` },
    )
  }

  // 2) Mês anterior no verde
  if (isCurrent && prevTotals.income > 0 && prevTotals.balance > 0) {
    out.push({
      id: 'green',
      tone: 'good',
      icon: 'party-popper',
      text: `Parabéns! ${cap(monthName(prevKey))} fechou no verde com ${brlSoft(prevTotals.balance)} de sobra.`,
    })
  } else if (!isCurrent && curTotals.income > 0 && curTotals.balance > 0) {
    out.push({ id: 'green', tone: 'good', icon: 'party-popper', text: `${cap(monthName(month))} fechou no verde. Muito bem!` })
  }

  // 3) Metas em 80% / 100%
  for (const b of budgetProgress(budgets, categories, cur)) {
    if (b.status === 'over') {
      out.push({ id: `budget-${b.id}`, tone: 'bad', icon: 'target', text: `${b.category.name} passou da meta do mês (${Math.round(b.ratio * 100)}%).` })
    } else if (b.status === 'warn') {
      out.push({ id: `budget-${b.id}`, tone: 'warn', icon: 'target', text: `${b.category.name} já usou ${Math.round(b.ratio * 100)}% da meta. Vale ir com calma.` })
    }
  }

  // 4) Variação por categoria vs. mês anterior
  const curCats = byCategory(cur, categories)
  const prevCats = new Map(byCategory(prev, categories).map((c) => [c.id, c.value]))
  const changes = curCats
    .filter((c) => (prevCats.get(c.id) || 0) > 0)
    .map((c) => ({ ...c, prev: prevCats.get(c.id), change: ((c.value - prevCats.get(c.id)) / prevCats.get(c.id)) * 100 }))
    .filter((c) => Math.abs(c.change) >= 10)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
  for (const c of changes.slice(0, 2)) {
    const up = c.change > 0
    out.push({
      id: `var-${c.id}`,
      tone: up ? 'info' : 'good',
      icon: up ? 'trending-up' : 'trending-down',
      text: `${c.label}: ${up ? '+' : ''}${Math.round(c.change)}% em relação a ${monthName(prevKey)}.`,
    })
  }

  // 5) Categoria que mais cresceu (em reais)
  const grew = curCats
    .map((c) => ({ ...c, delta: c.value - (prevCats.get(c.id) || 0) }))
    .sort((a, b) => b.delta - a.delta)[0]
  if (grew && grew.delta > 0 && prev.length) {
    out.push({ id: 'grew', tone: 'info', icon: 'chart-column', text: `${grew.label} foi a categoria que mais cresceu: ${brlSoft(grew.delta)} a mais.` })
  }

  // 6) Maior gasto do mês
  const biggest = cur.filter((t) => t.type === 'expense' && isNormal(t)).sort((a, b) => b.amount - a.amount)[0]
  if (biggest) {
    out.push({
      id: 'biggest',
      tone: 'info',
      icon: 'receipt',
      text: `Maior gasto do mês: ${biggest.description || 'sem descrição'} (${brlSoft(biggest.amount)}).`,
    })
  }

  // 7) Dia da semana que mais gasta (últimos 3 meses)
  const from = `${addMonths(month, -2)}-01`
  const recent = transactions.filter(
    (t) => t.type === 'expense' && isNormal(t) && !t.recurring_id && t.date >= from && t.date.slice(0, 7) <= month,
  )
  if (recent.length >= 8) {
    const perDay = Array(7).fill(0)
    for (const t of recent) perDay[parseISO(t.date).getDay()] += Number(t.amount)
    const max = perDay.indexOf(Math.max(...perDay))
    out.push({ id: 'weekday', tone: 'info', icon: 'calendar-days', text: `É na ${weekdayName(max)} que vocês mais gastam.` })
  }

  // 8) Cartões perto do limite
  for (const card of cards) {
    if (!card.credit_limit) continue
    const ratio = cardUsed(card, transactions) / Number(card.credit_limit)
    if (ratio >= 0.8) {
      out.push({
        id: `card-${card.id}`,
        tone: ratio >= 1 ? 'bad' : 'warn',
        icon: 'credit-card',
        text: `O cartão ${card.name} já usa ${Math.round(ratio * 100)}% do limite.`,
      })
    }
    const open = cardInvoices(card, transactions).find((i) => i.status === 'closed' || i.status === 'overdue')
    if (open) {
      out.push({
        id: `inv-${card.id}`,
        tone: open.status === 'overdue' ? 'bad' : 'warn',
        icon: 'calendar-clock',
        text: `Fatura do ${card.name} (${brlSoft(open.open)}) ${open.status === 'overdue' ? 'está vencida' : 'já fechou'} — não esqueça de pagar.`,
      })
    }
  }

  if (!out.length) {
    out.push({ id: 'empty', tone: 'info', icon: 'lightbulb', text: 'Conforme vocês lançarem ganhos e gastos, dicas personalizadas aparecem aqui.' })
  }
  return out
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
