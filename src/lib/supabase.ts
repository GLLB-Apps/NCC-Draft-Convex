// Appwrite-backed compatibility layer.
// Exposes the same surface the app used from `@supabase/supabase-js`
// (`supabase.from(...).select()/.eq()/.order()/.insert()/...` and `supabase.auth.*`)
// so the rest of the codebase did not need a rewrite when we migrated
// from Supabase to Appwrite.
import { Client, Account, Databases, Query, ID } from 'appwrite'

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID)

const account = new Account(client)
const databases = new Databases(client)
const DB = import.meta.env.VITE_APPWRITE_DATABASE_ID

// Fields stored as JSON strings in Appwrite but consumed as objects/arrays in the app.
const JSON_FIELDS: Record<string, string[]> = {
  topics: ['content'],
  posts: ['content', 'tags'],
  site_settings: ['social_links', 'background_blocks', 'hero_buttons', 'important_dates'],
  audit_log: ['details'],
  pages: ['texts', 'blocks'],
  custom_pages: ['blocks'],
  map_areas: ['points'],
  profiles: ['notifications_seen'],
}

// App column -> Appwrite system attribute.
const SYS: Record<string, string> = { id: '$id', created_at: '$createdAt', updated_at: '$updatedAt' }
const col = (c: string) => SYS[c] ?? c

type Row = Record<string, any>

function fromDoc(table: string, doc: Row): Row {
  const out: Row = { ...doc, id: doc.$id, created_at: doc.$createdAt, updated_at: doc.$updatedAt }
  for (const field of JSON_FIELDS[table] ?? []) {
    if (typeof out[field] === 'string') {
      try { out[field] = JSON.parse(out[field]) } catch { /* leave as-is */ }
    }
  }
  return out
}

function toData(table: string, obj: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === 'created_at' || k === 'updated_at' || k.startsWith('$')) continue
    if (v === undefined) continue
    out[k] = v
  }
  for (const field of JSON_FIELDS[table] ?? []) {
    if (out[field] !== undefined && typeof out[field] !== 'string') out[field] = JSON.stringify(out[field])
  }
  return out
}

const errOf = (e: any) => ({ message: e?.message ?? String(e), code: e?.code })

interface Result<T = any> { data: T; error: { message: string } | null }

class QueryBuilder implements PromiseLike<Result> {
  private table: string
  private eqs: [string, any][] = []
  private orders: [string, 'asc' | 'desc'][] = []
  private post: ((rows: Row[]) => Row[])[] = []
  private _limit = 200
  private _single = false
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: any

  constructor(table: string) { this.table = table }

  select(_cols?: string) { return this }
  eq(c: string, v: any) { this.eqs.push([c, v]); return this }
  order(c: string, opts?: { ascending?: boolean }) {
    this.orders.push([c, opts?.ascending === false ? 'desc' : 'asc']); return this
  }
  limit(n: number) { this._limit = n; return this }
  maybeSingle() { this._single = true; return this }
  single() { this._single = true; return this }

  ilike(c: string, pattern: string) {
    const needle = pattern.replace(/%/g, '').toLowerCase()
    this.post.push(rows => rows.filter(r => String(r[c] ?? '').toLowerCase().includes(needle)))
    return this
  }
  gte(c: string, v: any) { this.post.push(rows => rows.filter(r => r[c] != null && r[c] >= v)); return this }
  lte(c: string, v: any) { this.post.push(rows => rows.filter(r => r[c] != null && r[c] <= v)); return this }

  insert(data: any) { this.op = 'insert'; this.payload = data; return this }
  update(data: any) { this.op = 'update'; this.payload = data; return this }
  upsert(data: any) { this.op = 'upsert'; this.payload = data; return this }
  delete() { this.op = 'delete'; return this }

  private buildQueries() {
    const q = this.eqs.map(([c, v]) => Query.equal(col(c), [v] as any))
    for (const [c, dir] of this.orders) q.push(dir === 'desc' ? Query.orderDesc(col(c)) : Query.orderAsc(col(c)))
    q.push(Query.limit(this._limit))
    return q
  }

  private async targetIds(): Promise<string[]> {
    const idEq = this.eqs.find(([c]) => c === 'id')
    if (idEq) return [idEq[1]]
    const q = this.eqs.map(([c, v]) => Query.equal(col(c), [v] as any))
    q.push(Query.limit(500))
    const res = await databases.listDocuments({ databaseId: DB, collectionId: this.table, queries: q })
    return res.documents.map(d => d.$id)
  }

  private async run(): Promise<Result> {
    try {
      if (this.op === 'select') {
        const res = await databases.listDocuments({ databaseId: DB, collectionId: this.table, queries: this.buildQueries() })
        let rows = res.documents.map(d => fromDoc(this.table, d))
        for (const f of this.post) rows = f(rows)
        return { data: this._single ? (rows[0] ?? null) : rows, error: null }
      }
      if (this.op === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload]
        let last: Row | null = null
        for (const it of items) {
          const documentId = it?.id ?? ID.unique()
          const created = await databases.createDocument({ databaseId: DB, collectionId: this.table, documentId, data: toData(this.table, it) })
          last = fromDoc(this.table, created)
        }
        return { data: last, error: null }
      }
      if (this.op === 'upsert') {
        const documentId = this.payload?.id ?? ID.unique()
        const data = toData(this.table, this.payload)
        try {
          await databases.updateDocument({ databaseId: DB, collectionId: this.table, documentId, data })
        } catch (e: any) {
          if (e?.code === 404) await databases.createDocument({ databaseId: DB, collectionId: this.table, documentId, data })
          else throw e
        }
        return { data: null, error: null }
      }
      if (this.op === 'update') {
        const data = toData(this.table, this.payload)
        for (const id of await this.targetIds()) {
          await databases.updateDocument({ databaseId: DB, collectionId: this.table, documentId: id, data })
        }
        return { data: null, error: null }
      }
      if (this.op === 'delete') {
        for (const id of await this.targetIds()) {
          await databases.deleteDocument({ databaseId: DB, collectionId: this.table, documentId: id })
        }
        return { data: null, error: null }
      }
      return { data: null, error: null }
    } catch (e) {
      return { data: this._single ? null : (this.op === 'select' ? [] : null), error: errOf(e) }
    }
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }
}

// ---- auth ------------------------------------------------------------------
type Session = { user: { id: string; email: string } } | null
type AuthListener = (event: string, session: Session) => void
const listeners: AuthListener[] = []
function emit(event: string, session: Session) { for (const l of listeners) l(event, session) }

async function currentSession(): Promise<Session> {
  try {
    const u = await account.get()
    return { user: { id: u.$id, email: u.email } }
  } catch {
    return null
  }
}

const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      await account.createEmailPasswordSession({ email, password })
      const session = await currentSession()
      emit('SIGNED_IN', session)
      return { data: { user: session?.user ?? null, session }, error: null }
    } catch (e) {
      return { data: { user: null, session: null }, error: errOf(e) }
    }
  },
  async signUp({ email, password }: { email: string; password: string }) {
    try {
      const u = await account.create({ userId: ID.unique(), email, password })
      return { data: { user: { id: u.$id, email: u.email } }, error: null }
    } catch (e) {
      return { data: { user: null }, error: errOf(e) }
    }
  },
  async signOut() {
    try { await account.deleteSession({ sessionId: 'current' }) } catch { /* ignore */ }
    emit('SIGNED_OUT', null)
    return { error: null }
  },
  async getSession() {
    return { data: { session: await currentSession() }, error: null }
  },
  onAuthStateChange(cb: AuthListener) {
    listeners.push(cb)
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = listeners.indexOf(cb)
            if (i >= 0) listeners.splice(i, 1)
          },
        },
      },
    }
  },
}

export const supabase = {
  from: (table: string) => new QueryBuilder(table),
  auth,
}

// Mint a short-lived JWT for the current session, so serverless functions can
// verify the caller's identity/permissions (e.g. changing another user's password).
export async function createSessionJwt(): Promise<string> {
  const { jwt } = await account.createJWT()
  return jwt
}
