// Decodificador PNG mínimo (8-bit RGBA/RGB, sem entrelaçamento).
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export function decodePng(file) {
  const buf = readFileSync(file)
  let pos = 8
  let width, height, colorType
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
      if (data[8] !== 8 || data[12] !== 0 || ![2, 6].includes(colorType)) throw new Error('PNG não suportado')
    } else if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let v = line[i]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = v & 0xff
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      out[o] = line[x * bpp]
      out[o + 1] = line[x * bpp + 1]
      out[o + 2] = line[x * bpp + 2]
      out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255
    }
    prev = line
  }
  return { width, height, data: out }
}
