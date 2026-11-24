// Exportação CSV (separador ";" e BOM para abrir corretamente no Excel em pt-BR)
export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = columns.map((c) => esc(c.label)).join(';')
  const body = rows.map((r) => columns.map((c) => esc(c.value(r))).join(';'))
  return '﻿' + [head, ...body].join('\r\n')
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
