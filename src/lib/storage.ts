// Thin helper around Appwrite Storage for admin file uploads.
// Uploads go to the public "media" bucket; the returned URL is a public
// view link that the site can render directly.
import { Client, Storage, ID } from 'appwrite'

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

const storage = new Storage(client)
const BUCKET = import.meta.env.VITE_APPWRITE_BUCKET_ID

export async function uploadFile(file: File): Promise<string> {
  const created = await storage.createFile({ bucketId: BUCKET, fileId: ID.unique(), file })
  return String(storage.getFileView({ bucketId: BUCKET, fileId: created.$id }))
}

export const isImage = (file: File) => file.type.startsWith('image/')
