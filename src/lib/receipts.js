// Comprovantes: imagens são reduzidas (máx. 1600px, JPEG) e PDFs vão como estão.
// Bucket privado "receipts", pasta por casa: <household_id>/<arquivo>
import { supabase } from './supabaseClient'

const MAX = 1600

async function compressImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar a imagem.'))), 'image/jpeg', 0.82),
  )
}

export async function uploadReceipt(householdId, txId, file) {
  if (!navigator.onLine) throw new Error('Conecte-se à internet para anexar o comprovante.')
  let body = file
  let ext = 'pdf'
  let contentType = 'application/pdf'
  if (file.type.startsWith('image/')) {
    body = await compressImage(file)
    ext = 'jpg'
    contentType = 'image/jpeg'
  } else if (file.type !== 'application/pdf') {
    throw new Error('Envie uma foto ou um PDF.')
  }
  if (body.size > 5 * 1024 * 1024) throw new Error('Arquivo muito grande (máx. 5 MB).')
  const path = `${householdId}/${txId}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, body, { contentType, upsert: false })
  if (error) {
    if (String(error.message).toLowerCase().includes('bucket')) {
      throw new Error('Armazenamento de comprovantes não configurado (rode a migration 20261124000006).')
    }
    throw error
  }
  return path
}

export async function receiptUrl(path) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteReceipt(path) {
  if (path) await supabase.storage.from('receipts').remove([path])
}

export const isPdf = (path = '') => path.toLowerCase().endsWith('.pdf')
