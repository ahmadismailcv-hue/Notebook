import { supabase } from './supabase'

const MAX_EDGE = 2000

// iPhone photos are often 4–12 MB; shrink before upload so pages stay fast on mobile data.
async function downscale(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1_500_000 && file.type !== 'image/heic') {
    bitmap.close()
    return file
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  return blob ?? file
}

export async function uploadImage(file: File): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Not signed in')
  const blob = await downscale(file)
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/gif' ? 'gif' : blob.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('images').upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
  })
  if (error) throw error
  return supabase.storage.from('images').getPublicUrl(path).data.publicUrl
}

export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}
