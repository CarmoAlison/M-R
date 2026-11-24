// Foto de perfil: recorta em quadrado, reduz para 320px (JPEG) e envia ao Storage.
import { supabase } from './supabaseClient'

const SIZE = 320

export async function resizeToSquare(file) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Imagem muito grande (máx. 15 MB).')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('Não foi possível ler esta imagem.')
  })
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a imagem.'))), 'image/jpeg', 0.86),
  )
}

export async function uploadAvatar(userId, file) {
  const blob = await resizeToSquare(file)
  const path = `${userId}/avatar.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600',
  })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return `${data.publicUrl}?v=${Date.now()}` // evita cache da foto antiga
}

export async function removeAvatar(userId) {
  await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`])
}
