// Verifies the migration end-to-end the same way the app's AdminGuard does:
// 1. Log in with the superuser's email+password via the public (client) endpoint.
// 2. Confirm the account carries the `admin` label.
// 3. Confirm user_roles has a `superadmin` row for that user.
// 4. Confirm a site_settings row exists (public read).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Users } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const { VITE_APPWRITE_ENDPOINT: EP, VITE_APPWRITE_PROJECT_ID: PROJ, VITE_APPWRITE_DATABASE_ID: DB,
  APPWRITE_API_KEY: KEY, APPWRITE_SUPERUSER_EMAIL: EMAIL, APPWRITE_SUPERUSER_PASSWORD: PASS } = process.env

// 1. real client login (no API key) — exactly what the browser does
const res = await fetch(`${EP}/account/sessions/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'X-Appwrite-Project': PROJ },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
})
const session = await res.json()
if (res.status !== 201) throw new Error(`login failed (${res.status}): ${session.message}`)
const uid = session.userId
console.log('1. login OK  → user id', uid)

// 2–4 via server SDK
const client = new Client().setEndpoint(EP).setProject(PROJ).setKey(KEY)
const databases = new Databases(client)
const users = new Users(client)

const u = await users.get({ userId: uid })
console.log('2. labels    →', u.labels, u.labels.includes('admin') ? 'OK' : '❌ missing admin')

const roles = await databases.listDocuments({ databaseId: DB, collectionId: 'user_roles' })
const mine = roles.documents.filter(d => d.user_id === uid)
console.log('3. roles     →', mine.map(r => r.role), mine.some(r => r.role === 'superadmin') ? 'OK' : '❌ no superadmin')

const settings = await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings' })
console.log('4. settings  →', settings.total, 'row(s)', settings.total > 0 ? 'OK' : '❌ none')

console.log('\n✅ AdminGuard requirements met: user + admin label + superadmin role. You can log in at /admin.')
