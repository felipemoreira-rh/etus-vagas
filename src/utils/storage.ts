import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'

export interface UploadResult {
  url: string
  path: string
  nome: string
  tamanho: number
}

/**
 * Faz upload de um arquivo para o Firebase Storage.
 * Retorna a URL pública e o path pra poder deletar depois.
 */
export async function uploadFile(file: File, folder: string): Promise<UploadResult> {
  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${folder}/${timestamp}_${safeName}`
  const r = ref(storage, path)
  await uploadBytes(r, file)
  const url = await getDownloadURL(r)
  return { url, path, nome: file.name, tamanho: file.size }
}

/**
 * Remove um arquivo do Storage. Ignora erro de "não encontrado".
 */
export async function removeFile(path: string): Promise<void> {
  if (!path) return
  try {
    await deleteObject(ref(storage, path))
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.includes('object-not-found')) {
      throw err
    }
  }
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
