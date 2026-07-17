// Adds a `blocks` attribute to the `pages` collection so Sidor pages can hold
// free-form block content (stored as a JSON string), edited via TapEditor.
// Idempotent.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'

try {
  await databases.createStringAttribute({ databaseId: DB, collectionId: 'pages', key: 'blocks', size: 100000, required: false })
  console.log('✓ pages.blocks created')
} catch (e) {
  if (e?.code === 409) console.log('• pages.blocks already exists')
  else throw e
}
console.log('Done.')
