// Lägger till inställningar för hur kontaktformulärets meddelanden tas emot:
//   contact_delivery  – 'system' | 'email' | 'both'
//   contact_recipient – mottagar-e-post (för e-postutskick via Resend)
//   contact_from      – avsändaradress (verifierad Resend-domän)
// Fälten görs TEXT-stora (size 100000) så de lagras som TEXT och inte belastar
// site_settings radbudget (samma trick som hero_buttons). Idempotent.
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
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function add(key, def = null) {
  try {
    await databases.createStringAttribute({ databaseId: DB, collectionId: 'site_settings', key, size: 100000, required: false, default: def })
    console.log('  ✓', key)
  } catch (e) { if (e?.code === 409) console.log('  •', key, '(finns)'); else throw e }
}

await add('contact_delivery', 'system')
await add('contact_recipient')
await add('contact_from')

for (let i = 0; i < 30; i++) {
  const a = await databases.listAttributes({ databaseId: DB, collectionId: 'site_settings' })
  const byKey = Object.fromEntries(a.attributes.map(x => [x.key, x.status]))
  if (['contact_delivery', 'contact_recipient', 'contact_from'].every(k => byKey[k] === 'available')) break
  await sleep(1000)
}
console.log('Klart.')
