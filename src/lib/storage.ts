// Filuppladdning mot Convex Storage. Ersätter Appwrite Storage.
import { convexClient } from './convexClient'
import { api } from '../../convex/_generated/api'

const HEIC_EXT = /\.(heic|heif)$/i
/**
 * iPhone sparar foton som HEIC. Ingen webbläsare utom Safari kan visa formatet,
 * så en HEIC-uppladdning blir en trasig bild på sajten – filen måste göras om
 * till JPEG innan den laddas upp.
 */
export const isHeic = (file: File) => /image\/hei[cf]/i.test(file.type) || HEIC_EXT.test(file.name)

async function toJpeg(file: File): Promise<File> {
  // Laddas först när någon faktiskt släpper en HEIC – biblioteket är stort.
  const { default: heic2any } = await import('heic2any')
  let converted: Blob
  try {
    const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
    converted = Array.isArray(result) ? result[0] : result
  } catch {
    throw new Error(`${file.name} är en HEIC-bild som inte gick att konvertera. Spara om den som JPEG och försök igen.`)
  }
  return new File([converted], file.name.replace(HEIC_EXT, '') + '.jpg', { type: 'image/jpeg' })
}

export async function uploadFile(file: File): Promise<string> {
  const upload = isHeic(file) ? await toJpeg(file) : file

  const uploadUrl = await convexClient.mutation(api.uploads.generateUploadUrl, {})
  const res = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': upload.type }, body: upload })
  if (!res.ok) throw new Error('Uppladdningen misslyckades.')
  const { storageId } = await res.json()

  // finalize() validerar MIME/storlek mot den lagrade metadatan och
  // returnerar en färdig URL — se convex/uploads.ts.
  return await convexClient.mutation(api.uploads.finalize, { storageId })
}

// HEIC-filer saknar ofta MIME-typ i webbläsaren, därför även filändelsen.
export const isImage = (file: File) => file.type.startsWith('image/') || isHeic(file)
