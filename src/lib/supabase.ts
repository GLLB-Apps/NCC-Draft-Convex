// Convex-backed compatibility layer.
// Exposes the same surface the app used from `@supabase/supabase-js` (and
// later Appwrite: `supabase.from(...).select()/.eq()/.order()/.insert()/...`
// and `supabase.auth.*`) so ~30 admin/public pages did not need a rewrite
// for this migration either — se MIGRATION_PLAN.md §4. `run()` talks to
// Convex via den IMPERATIVA klienten (query()/mutation()/action()), inte
// React-hooken useQuery, eftersom alla befintliga anropsplatser gör
// `await supabase.from(...)` utanför komponent-render.
import { convexClient } from './convexClient'
import { TABLE_API } from './convexCompat'
import { api } from '../../convex/_generated/api'

type Row = Record<string, any>

function fromDoc(doc: Row): Row {
  const { _id, _creationTime, ...rest } = doc
  return { ...rest, id: _id }
}

function toData(obj: Row): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'id' || k === '_id' || k === '_creationTime') continue
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

const errOf = (e: any) => ({ message: e?.message ?? String(e), code: e?.data?.code })

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

  private eqObj(): Record<string, any> {
    return Object.fromEntries(this.eqs)
  }

  /** `.eq('id', v)` pekar direkt på ett Convex-dokument utan en föregående listning. */
  private idEq(): string | null {
    const found = this.eqs.find(([c]) => c === 'id')
    return found ? (found[1] as string) : null
  }

  /** Alla rader som matchar nuvarande eq-filter (via list), för update/delete utan ett direkt id. */
  private async targetRows(fns: Row): Promise<Row[]> {
    const rows = await convexClient.query(fns.list, { eq: this.eqObj() })
    return rows.map(fromDoc)
  }

  private async run(): Promise<Result> {
    try {
      // "profiles" slogs ihop till fält på users-dokumentet (se users.ts) —
      // specialfall, finns inte i TABLE_API.
      if (this.table === 'profiles') return await this.runProfiles()

      const fns = TABLE_API[this.table]
      if (!fns) throw new Error(`Okänd tabell: ${this.table}`)

      if (this.op === 'select') {
        // .eq('id', x) måste gå via fns.get(), INTE fns.list({eq:{id:x}}) —
        // "id" är ett VIRTUELLT fält som bara läggs på av fromDoc() HÄR på
        // klienten (mappat från Convex's riktiga _id). Det ursprungliga
        // dokumentet på servern har aldrig en "id"-nyckel, så ett
        // eq-filter på "id" matchar där ALDRIG något — exakt samma
        // specialfall update()/delete() redan löste via idEq(), men som
        // select() saknade helt (upptäckt: AdminNewsEdit.tsx m.fl. — en
        // redigeringssida som hämtar via .eq('id', id).maybeSingle() fick
        // tyst tillbaka en tom lista, dvs ett helt blankt formulär).
        const directId = this.idEq()
        if (directId) {
          const row = await convexClient.query(fns.get, { id: directId })
          const rows = row ? [fromDoc(row)] : []
          return { data: this._single ? (rows[0] ?? null) : rows, error: null }
        }

        // ALLA .order()-anrop skickas med, inte bara det första — en andra
        // sorteringsnyckel (t.ex. "nyast först" INOM fästa/ej fästa-gruppen)
        // föll tidigare bort helt tyst här.
        const order = this.orders.length
          ? this.orders.map(([field, dir]) => ({ field, ascending: dir === 'asc' }))
          : undefined
        let rows: Row[] = await convexClient.query(fns.list, { eq: this.eqObj(), order, limit: this._limit })
        rows = rows.map(fromDoc)
        for (const f of this.post) rows = f(rows)
        return { data: this._single ? (rows[0] ?? null) : rows, error: null }
      }

      if (this.op === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload]
        let last: Row | null = null
        for (const it of items) {
          const id = await convexClient.mutation(fns.create, { data: toData(it) })
          last = fromDoc(await convexClient.query(fns.get, { id }))
        }
        return { data: last, error: null }
      }

      if (this.op === 'upsert') {
        // "pages" nyckeln är slug, inte ett i förväg känt id — se pages.ts: upsert().
        if (this.table === 'pages') {
          // Shimmen dispatchar dynamiskt mot en statiskt typad Convex-funktion
          // med avsikt (se convexCompat.ts) — castad här vid gränsen, inte
          // typad rakt igenom.
          await convexClient.mutation(api.pages.upsert, toData(this.payload) as any)
          return { data: null, error: null }
        }
        const id = this.idEq() ?? this.payload?.id
        if (id) {
          await convexClient.mutation(fns.update, { id, patch: toData(this.payload) })
        } else {
          await convexClient.mutation(fns.create, { data: toData(this.payload) })
        }
        return { data: null, error: null }
      }

      if (this.op === 'update') {
        const data = toData(this.payload)
        const directId = this.idEq()
        const ids = directId ? [directId] : (await this.targetRows(fns)).map(r => r.id)
        for (const id of ids) await convexClient.mutation(fns.update, { id, patch: data })
        return { data: null, error: null }
      }

      if (this.op === 'delete') {
        const directId = this.idEq()
        const ids = directId ? [directId] : (await this.targetRows(fns)).map(r => r.id)
        for (const id of ids) await convexClient.mutation(fns.remove, { id })
        return { data: null, error: null }
      }

      return { data: null, error: null }
    } catch (e) {
      return { data: this._single ? null : (this.op === 'select' ? [] : null), error: errOf(e) }
    }
  }

  /** profiles-virtuella tabellen → fält på users-dokumentet, se convex/users.ts. */
  private async runProfiles(): Promise<Result> {
    if (this.op === 'select') {
      const id = this.idEq()
      if (!id) return { data: this._single ? null : [], error: null }
      const row = await convexClient.query(api.users.getProfile, { id } as any)
      return { data: this._single ? row : (row ? [row] : []), error: null }
    }
    if (this.op === 'insert') {
      // Direkt efter signUp — kontot har ingen roll/intranet_member än.
      const ok = await convexClient.mutation(api.users.setPendingProfile, {
        id: this.payload.id, display_name: this.payload.display_name, intro: this.payload.intro,
      })
      return { data: null, error: ok ? null : { message: 'Kunde inte spara presentationen.' } }
    }
    if (this.op === 'upsert') {
      // Den inloggades egen rad (notifikationer m.m.) — se notifications.tsx/intranetNotifications.tsx.
      const { id: _id, ...patch } = this.payload
      await convexClient.mutation(api.users.updateProfile, patch)
      return { data: null, error: null }
    }
    return { data: null, error: null }
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected)
  }
}

// Inget supabase.auth längre — AdminLogin.tsx/AdminResetPassword.tsx anropar
// Convex Auth direkt (useAuthActions()-hooken för signIn/signUp, convexClient
// imperativt för de åtgärder som inte etablerar en session). Se
// MIGRATION_PLAN.md §4: en tidigare version försökte låta den imperativa
// Convex-klienten anropa api.auth.signIn direkt här, vilket skapade en
// session SERVER-side men aldrig kopplade in den i klientens eget
// auth-tillstånd — inloggningen "lyckades" tyst men appen förblev utloggad.
export const supabase = {
  from: (table: string) => new QueryBuilder(table),
}
