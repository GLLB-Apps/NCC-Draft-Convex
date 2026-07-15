// Creates a public "media" storage bucket for drag-and-drop uploads.
// Files are readable by anyone (so the public site can show them); only admins
// (label:admin) can upload/replace/delete. Idempotent.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Storage } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const storage = new Storage(client)
const BUCKET = process.env.VITE_APPWRITE_BUCKET_ID || 'media'

try {
  await storage.createBucket({
    bucketId: BUCKET,
    name: 'Media',
    permissions: ['read("any")', 'create("label:admin")', 'update("label:admin")', 'delete("label:admin")'],
    fileSecurity: false,
    enabled: true,
    maximumFileSize: 30000000,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'pdf'],
  })
  console.log(`✓ bucket "${BUCKET}" created (public read, admin write)`)
} catch (e) {
  if (e?.code === 409) console.log(`• bucket "${BUCKET}" already exists`)
  else throw e
}
console.log('Done.')
