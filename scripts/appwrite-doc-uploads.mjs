// Widen the media bucket so admins can upload document files (PDF, Office
// formats) in addition to images, and raise the size limit. Keeps anonymous
// create (for testimony images) and admin-only update/delete. Idempotent.
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

await storage.updateBucket({
  bucketId: BUCKET,
  name: 'Media',
  permissions: ['read("any")', 'create("any")', 'update("label:admin")', 'delete("label:admin")'],
  fileSecurity: false,
  enabled: true,
  maximumFileSize: 30000000,
  allowedFileExtensions: [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'txt', 'csv', 'zip',
  ],
})
console.log('✓ media bucket: documents allowed (pdf/office/etc), max 30MB')
console.log('Done.')
