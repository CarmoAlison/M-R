// Importação de extratos: CSV (bancos e cartões brasileiros) e OFX.
// Saída: [{ date: 'YYYY-MM-DD', description, amount (com sinal: + entrada, − saída), fitid }]

export async function readFileText(file) {
  const buf = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buf)
  // muitos bancos exportam em Latin-1/Windows-1252
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8
}

export function parseStatement(text, filename = '') {
  const isOfx = /\.ofx$/i.test(filename) || /<OFX>|<STMTTRN>/i.test(text)
  return isOfx ? parseOFX(text) : parseCSV(text)
}

// ------------------------------------------------------------------ OFX
function ofxTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : ''
}

export function parseOFX(text) {
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  return blocks
    .map((b) => {
      const d = ofxTag(b, 'DTPOSTED')
      const amount = Number(ofxTag(b, 'TRNAMT').replace(',', '.'))
      return {
        date: d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : '',
        description: decodeEntities(ofxTag(b, 'MEMO') || ofxTag(b, 'NAME')),
        amount,
        fitid: ofxTag(b, 'FITID'),
      }
    })
    .filter((r) => r.date && Number.isFinite(r.amount) && r.amount !== 0)
}

const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ')

// ------------------------------------------------------------------ CSV
function splitLine(line, sep) {
  const out = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"'
        i++
      } else quoted = !quoted
    } else if (ch === sep && !quoted) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** "1.234,56" | "-1234.56" | "R$ 10,00" | "(10,00)" -> número */
export function parseAmount(raw) {
  if (raw == null) return NaN
  let s = String(raw).replace(/R\$|\s/g, '')
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-') || /-$/.test(s)
  s = s.replace(/[()\-+]/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = Number(s)
  return negative ? -n : n
}

/** dd/mm/aaaa | dd/mm/aa | aaaa-mm-dd | dd-mm-aaaa -> aaaa-mm-dd */
export function parseDate(raw) {
  const s = String(raw || '').trim().slice(0, 10)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return ''
}

const COLS = {
  date: ['data', 'date', 'data lancamento', 'data do lancamento', 'data movimento', 'dt'],
  description: ['descricao', 'description', 'historico', 'lancamento', 'title', 'titulo', 'estabelecimento', 'detalhe', 'memo'],
  amount: ['valor', 'amount', 'valor (r$)', 'valor r$', 'quantia', 'montante'],
  credit: ['entrada', 'credito', 'entradas', 'creditos'],
  debit: ['saida', 'debito', 'saidas', 'debitos'],
}

function findCol(headers, names) {
  const idx = headers.findIndex((h) => names.includes(h))
  if (idx >= 0) return idx
  return headers.findIndex((h) => names.some((n) => h.startsWith(n)))
}

export function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  // acha a linha de cabeçalho (alguns bancos põem informações antes)
  let headerIdx = lines.findIndex((l) => /data|date/i.test(l) && /valor|amount|entrada|saida|saída|cr[eé]dito|d[eé]bito/i.test(l))
  if (headerIdx < 0) headerIdx = 0
  const head = lines[headerIdx]
  const sep = [';', ',', '\t'].sort((a, b) => head.split(b).length - head.split(a).length)[0]
  const headers = splitLine(head, sep).map(norm)
  const c = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, findCol(headers, names)]))
  if (c.date < 0 || (c.amount < 0 && c.credit < 0 && c.debit < 0)) {
    throw new Error('Não reconheci as colunas do arquivo. É preciso ter "Data", "Descrição" e "Valor" (ou "Entrada"/"Saída").')
  }

  const rows = []
  for (const line of lines.slice(headerIdx + 1)) {
    const cols = splitLine(line, sep)
    const date = parseDate(cols[c.date])
    if (!date) continue
    let amount
    if (c.amount >= 0) amount = parseAmount(cols[c.amount])
    else {
      const cr = c.credit >= 0 ? parseAmount(cols[c.credit]) : NaN
      const db = c.debit >= 0 ? parseAmount(cols[c.debit]) : NaN
      amount = (Number.isFinite(cr) ? Math.abs(cr) : 0) - (Number.isFinite(db) ? Math.abs(db) : 0)
    }
    if (!Number.isFinite(amount) || amount === 0) continue
    rows.push({ date, description: (c.description >= 0 ? cols[c.description] : '') || 'Sem descrição', amount, fitid: '' })
  }
  return rows
}

// ------------------------------------------------------------------ categorias automáticas
const RULES = [
  [/uber|99 ?(app|pop|taxi)|cabify|posto|combust|shell|ipiranga|petrobras|estaciona|pedagio|sem parar|veloe/, ['transporte']],
  [/ifood|rappi|restaurante|lanchonete|burger|mc ?donald|pizza|padaria|cafe|bar /, ['restaurantes', 'lazer']],
  [/mercado|supermerc|atacad|carrefour|assai|pao de acucar|extra |hortifruti|sacolao|big ?bom/, ['mercado']],
  [/farmacia|drogaria|drogasil|raia|pague menos|hospital|clinica|laborat|unimed|amil|hapvida|odonto/, ['saude']],
  [/netflix|spotify|prime video|amazon prime|disney|hbo|max\.com|globoplay|youtube|deezer|apple\.com|icloud|google one/, ['assinaturas']],
  [/aluguel|condominio|enel|light|cemig|copel|sabesp|energia|agua|gas |claro|vivo|tim |oi |internet|net virtua/, ['moradia']],
  [/escola|faculdade|curso|udemy|alura|livraria|mensalidade/, ['educacao']],
  [/cinema|ingresso|show|steam|playstation|xbox|viagem|hotel|airbnb|booking|decolar/, ['lazer']],
  [/salario|folha|pagamento de salario|proventos/, ['salario']],
  [/rendimento|juros|dividend|resgate|cdb|tesouro/, ['investimentos']],
]

/** Sugere a categoria pelo texto da descrição. */
export function guessCategory(description, type, categories) {
  const text = norm(description)
  const pool = categories.filter((c) => c.type === type && !c.archived)
  for (const [re, names] of RULES) {
    if (!re.test(text)) continue
    for (const n of names) {
      const hit = pool.find((c) => norm(c.name) === n)
      if (hit) return hit.id
    }
  }
  return pool.find((c) => norm(c.name) === 'outros')?.id || pool[pool.length - 1]?.id || null
}

/** Marca linhas que já parecem lançadas (mesma data, valor e conta/cartão). */
export function findDuplicates(rows, transactions, { accountId, cardId }) {
  const key = (date, amount) => `${date}|${Math.abs(amount).toFixed(2)}`
  const existing = new Set(
    transactions
      .filter((t) => (cardId ? t.card_id === cardId : t.account_id === accountId))
      .map((t) => key(t.date, Number(t.amount))),
  )
  return rows.map((r) => existing.has(key(r.date, r.amount)))
}
