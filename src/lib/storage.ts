// Thin helper around Appwrite Storage for admin file uploads.
// Uploads go to the public "media" bucket; the returned URL is a public
// view link that the site can render directly.
import { Client, Storage, ID } from 'appwrite'

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

const storage = new Storage(client)
const BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_ID

const HEIC_EXT = /\.(heic|heif)$/i
/**
 * iPhone sparar foton som HEIC. Ingen webbläsare utom Safari kan visa formatet,
 * så en HEIC-uppladdning blir en trasig bild på sajten – filen måste göras om
 * till JPEG innan den laddas upp. (Appwrites egen bildkonvertering är avstängd
 * på nuvarande plan, så det måste ske här.)
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
  const created = await storage.createFile({ bucketId: BUCKET, fileId: ID.unique(), file: upload })
  return String(storage.getFileView({ bucketId: BUCKET, fileId: created.$id }))
}

// HEIC-filer saknar ofta MIME-typ i webbläsaren, därför även filändelsen.
export const isImage = (file: File) => file.type.startsWith('image/') || isHeic(file)
