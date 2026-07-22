// Synkar Appwrite-åtkomstlabels med databasens tillstånd, så att befintliga
// konton får rätt label:
//   user_roles-rad        → label "admin"
//   intranet_members-rad  → label "member"
//   varken eller          → ingen åtkomstlabel
//
// Behövs eftersom äldre admins skapades utan att labeln sattes automatiskt
// (rollraden ensam ger inte skrivrätt). Idempotent — går att köra om.
// Kör lokalt:  node scripts/appwrite-sync-labels.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client, Databases, Users, Query } from 'node-appwrite'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !line.trim().startsWith('#')) process.env[m[1]] ??= m[2]
}
const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'
const client = new Client()
  .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
  .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
  .setKey(process.env.APPWRITE_API_KEY)
const databases = new Databases(client)
const users = new Users(client)
const ACCESS_LABELS = ['admin', 'member']

async function allRows(collectionId) {
  const out = []
  let cursor
  for (;;) {
    const q = [Query.limit(100)]
    if (cursor) q.push(Query.cursorAfter(cursor))
    const res = await databases.listDocuments({ databaseId: DB, collectionId, queries: q })
    out.push(...res.documents)
    if (res.documents.length < 100) break
    cursor = res.documents[res.documents.length - 1].$id
  }
  return out
}

const admins = new Set((await allRows('user_roles')).map(r => r.user_id))
const members = new Set((await allRows('intranet_members')).map(r => r.user_id))
// Admins ska inte samtidigt ha en medlemsrad; admin-labeln vinner.
for (const id of admins) members.delete(id)

console.log(`Admins: ${admins.size} · Intranätsmedlemmar: ${members.size}\n`)

// Gå igenom alla användare och sätt rätt åtkomstlabel.
let changed = 0
let cursor
for (;;) {
  const q = [Query.limit(100)]
  if (cursor) q.push(Query.cursorAfter(cursor))
  const res = await users.list({ queries: q })
  for (const u of res.users) {
    const want = admins.has(u.$id) ? 'admin' : members.has(u.$id) ? 'member' : null
    const current = u.labels || []
    const base = current.filter(l => !ACCESS_LABELS.includes(l))
    const next = want ? [...base, want] : base
    const before = [...current].sort().join(',')
    const after = [...next].sort().join(',')
    if (before !== after) {
      await users.updateLabels({ userId: u.$id, labels: next })
      console.log(`  ✓ ${u.email || u.$id}: [${before}] → [${after}]`)
      changed++
    }
  }
  if (res.users.length < 100) break
  cursor = res.users[res.users.length - 1].$id
}

console.log(`\n✅ Klart. ${changed} konto(n) uppdaterade.`)
