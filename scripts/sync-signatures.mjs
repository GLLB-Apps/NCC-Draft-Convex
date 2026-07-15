// Fetches the current Skrivunder signature count and writes it to
// site_settings.signature_count. Run this from a normal (residential) IP —
// the petition site's bot protection blocks datacenter IPs (Vercel), so the
// cloud cron may 403 while this local run works. Schedule it (e.g. Windows
// Task Scheduler) to run daily:  node scripts/sync-signatures.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}

const PETITION_URL = process.env.PETITION_URL || 'https://www.skrivunder.com/stoppa_ncc_i_skrylle'

const resp = await fetch(PETITION_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  },
})
if (!resp.ok) { console.error(`❌ petition fetch failed (${resp.status})`); process.exit(1) }
const html = await resp.text()

const m = html.match(/class="[^"]*signatureAmount[^"]*"[^>]*>([\d\s., ]+)</i)
if (!m) { console.error('❌ signature count not found'); process.exit(1) }
const count = parseInt(m[1].replace(/[^\d]/g, ''), 10)

const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'

const list = await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings' })
const doc = list.documents[0]
if (!doc) { console.error('❌ no site_settings document'); process.exit(1) }
await databases.updateDocument({ databaseId: DB, collectionId: 'site_settings', documentId: doc.$id, data: { signature_count: count } })

console.log(`✓ signature_count uppdaterad -> ${count}`)
