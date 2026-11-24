// Gera os ícones PWA (PNG) a partir da logo branca M&R, sobre a cor da marca.
// Uso: node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { decodePng } from './png-decode.mjs'

const BRAND = [0xa4, 0x83, 0x74]
const DEEP = [0x7a, 0x5b, 0x4e]
const LOGO = 'public/brand/logo-branca.png'

// ---------- PNG encoder mínimo
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- logo: recorta só o "M&R" (sem o texto de baixo)
const logo = decodePng(LOGO)
const alphaAt = (x, y) => logo.data[(y * logo.width + x) * 4 + 3]
const rowHasInk = (y) => {
  for (let x = 0; x < logo.width; x++) if (alphaAt(x, y) > 20) return true
  return false
}
let top = 0
while (!rowHasInk(top)) top++
let bottom = top
while (bottom < logo.height && rowHasInk(bottom)) bottom++ // para na 1ª linha vazia (antes do texto)
let left = logo.width, right = 0
for (let y = top; y < bottom; y++)
  for (let x = 0; x < logo.width; x++)
    if (alphaAt(x, y) > 20) {
      left = Math.min(left, x)
      right = Math.max(right, x)
    }
const crop = { x: left, y: top, w: right - left + 1, h: bottom - top }

const inRoundRect = (x, y, r) => {
  const cx = Math.max(r, Math.min(x, 1 - r))
  const cy = Math.max(r, Math.min(y, 1 - r))
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/** Retorna [r,g,b,a] do ponto (coordenadas 0..1). */
function sample(x, y, { rounded, width }) {
  if (rounded && !inRoundRect(x, y, 0.22)) return null
  const t = (x + y) / 2
  const bg = BRAND.map((c, i) => c + (DEEP[i] - c) * t * 0.6)
  // logo centralizada com a largura relativa pedida
  const h = (width * crop.h) / crop.w
  const u = (x - (1 - width) / 2) / width
  const v = (y - (1 - h) / 2) / h
  if (u >= 0 && u < 1 && v >= 0 && v < 1) {
    const sx = crop.x + Math.floor(u * crop.w)
    const sy = crop.y + Math.floor(v * crop.h)
    const o = (sy * logo.width + sx) * 4
    const a = logo.data[o + 3] / 255
    return bg.map((c, i) => c * (1 - a) + logo.data[o + i] * a)
  }
  return bg
}

function render(size, opts) {
  const SS = Math.max(4, Math.ceil((crop.w / (size * opts.width)) * 1.5))
  const buf = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, opts)
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; n++
          }
        }
      const i = (py * size + px) * 4
      buf[i] = n ? Math.round(r / n) : 0
      buf[i + 1] = n ? Math.round(g / n) : 0
      buf[i + 2] = n ? Math.round(b / n) : 0
      buf[i + 3] = Math.round((n / (SS * SS)) * 255)
    }
  }
  return png(size, buf)
}

mkdirSync('public/icons', { recursive: true })
const out = [
  ['public/icons/icon-192.png', 192, { rounded: true, width: 0.78 }],
  ['public/icons/icon-512.png', 512, { rounded: true, width: 0.78 }],
  ['public/icons/maskable-192.png', 192, { rounded: false, width: 0.62 }], // zona segura (círculo de 80%)
  ['public/icons/maskable-512.png', 512, { rounded: false, width: 0.62 }],
  ['public/icons/apple-touch-icon.png', 180, { rounded: false, width: 0.72 }],
  ['public/icons/favicon-64.png', 64, { rounded: true, width: 0.84 }],
]
for (const [file, size, opts] of out) {
  writeFileSync(file, render(size, opts))
  console.log('✓', file)
}
