import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { TableNames, Doc, Id } from '../_generated/dataModel'
import { requireAdmin, requireMember, requireIntranetWrite, currentUser, isAdmin } from './permissions'

// Delad list/get/create/update/replace/remove-logik, återanvänd av varje
// tabells tunna convex/*.ts-wrapper — samma roll som JsonCollection/
// SqliteCollection hade i PHP-versionen (server/lib/JsonCollection.php,
// SqliteCollection.php), fast som vanliga funktioner istället för en
// gränssnitts-implementerande klass, eftersom Convex-funktioner är statiskt
// namngivna per tabell (se MIGRATION_PLAN.md §1).
//
// Filtrering/sortering sker i minnet efter en full `.collect()`, precis som
// PHP:s RowFilter::apply() gjorde på sina associativa arrayer — rimligt för
// den här datavolymen (hundratals rader per tabell), och håller samma
// beteendeparitet (eq/ilike/gte/lte/order/limit) utan att behöva tvinga in
// dynamiska fältnamn i Convex's typade filter-builder.

export interface ListOptions {
  eq?: Record<string, unknown>
  ilike?: Record<string, string>
  gte?: Record<string, unknown>
  lte?: Record<string, unknown>
  order?: { field: string; ascending?: boolean }
  limit?: number
}

/** Statusgrind för publik läsning: fältet måste vara satt och ingå i publicValues om anroparen inte är admin. */
export interface StatusGate {
  field: string
  publicValues: readonly string[]
}

function matchesEq(row: Record<string, unknown>, eq?: Record<string, unknown>): boolean {
  if (!eq) return true
  return Object.entries(eq).every(([k, v]) => row[k] === v)
}

function matchesIlike(row: Record<string, unknown>, ilike?: Record<string, string>): boolean {
  if (!ilike) return true
  return Object.entries(ilike).every(([k, pattern]) => {
    const value = row[k]
    return typeof value === 'string' && value.toLowerCase().includes(pattern.toLowerCase())
  })
}

function matchesRange(row: Record<string, unknown>, bound?: Record<string, unknown>, cmp: (a: unknown, b: unknown) => boolean = () => true): boolean {
  if (!bound) return true
  return Object.entries(bound).every(([k, v]) => cmp(row[k], v))
}

function applyFilters<T extends Record<string, unknown>>(rows: T[], opts: ListOptions): T[] {
  let out = rows.filter(r =>
    matchesEq(r, opts.eq) &&
    matchesIlike(r, opts.ilike) &&
    matchesRange(r, opts.gte, (a, b) => a !== undefined && a !== null && (a as number | string) >= (b as number | string)) &&
    matchesRange(r, opts.lte, (a, b) => a !== undefined && a !== null && (a as number | string) <= (b as number | string)))

  if (opts.order) {
    const { field, ascending = true } = opts.order
    out = [...out].sort((a, b) => {
      const av = a[field] as number | string | undefined
      const bv = b[field] as number | string | undefined
      if (av === bv) return 0
      if (av === undefined) return 1
      if (bv === undefined) return -1
      return (av < bv ? -1 : 1) * (ascending ? 1 : -1)
    })
  }
  if (opts.limit !== undefined) out = out.slice(0, opts.limit)
  return out
}

/** Publikt läsbar lista utan statusgrind (t.ex. siteSettings, pages, navigationItems). */
export async function listPublic<T extends TableNames>(ctx: QueryCtx, table: T, opts: ListOptions = {}): Promise<Doc<T>[]> {
  const rows = await ctx.db.query(table).collect()
  return applyFilters(rows as unknown as Record<string, unknown>[], opts) as unknown as Doc<T>[]
}

/** Status-grindad lista: icke-admin ser bara rader vars statusfält matchar gate.publicValues. */
export async function listStatusGated<T extends TableNames>(
  ctx: QueryCtx, table: T, gate: StatusGate, opts: ListOptions = {},
): Promise<Doc<T>[]> {
  const user = await currentUser(ctx)
  const rows = await ctx.db.query(table).collect()
  const visible = isAdmin(user)
    ? rows
    : rows.filter(r => gate.publicValues.includes(String((r as Record<string, unknown>)[gate.field])))
  return applyFilters(visible as unknown as Record<string, unknown>[], opts) as unknown as Doc<T>[]
}

/** Admin-läsning enbart (t.ex. contactMessages, testimonyContacts, auditLog). */
export async function listAdminOnly<T extends TableNames>(ctx: QueryCtx, table: T, opts: ListOptions = {}): Promise<Doc<T>[]> {
  await requireAdmin(ctx)
  const rows = await ctx.db.query(table).collect()
  return applyFilters(rows as unknown as Record<string, unknown>[], opts) as unknown as Doc<T>[]
}

/** Intranät-läsning (medlem eller admin), t.ex. intranetNotes/intranetTasks. */
export async function listMemberOnly<T extends TableNames>(ctx: QueryCtx, table: T, opts: ListOptions = {}): Promise<Doc<T>[]> {
  await requireMember(ctx)
  const rows = await ctx.db.query(table).collect()
  return applyFilters(rows as unknown as Record<string, unknown>[], opts) as unknown as Doc<T>[]
}

// `table` tas emot bara för att matcha anropsmönstret i varje tabells fil
// (list/get/create/update/remove med samma signaturform) — ctx.db.get()
// härleder tabellen ur id:ts brandade typ på egen hand.
export async function getById<T extends TableNames>(ctx: QueryCtx, _table: T, id: Id<T>): Promise<Doc<T> | null> {
  return await ctx.db.get(id)
}

const nowIso = () => new Date().toISOString()

/** Admin-skapande/uppdatering/borttagning, med audit-loggning. */
export async function adminInsert<T extends TableNames>(
  ctx: MutationCtx, table: T, data: Record<string, unknown>, action: string,
): Promise<Id<T>> {
  const admin = await requireAdmin(ctx)
  const now = nowIso()
  const id = await ctx.db.insert(table, { ...data, created_at: data.created_at ?? now, updated_at: data.updated_at ?? now } as never)
  await logAudit(ctx, admin._id, action, table, id)
  return id
}

export async function adminPatch<T extends TableNames>(
  ctx: MutationCtx, table: T, id: Id<T>, patch: Record<string, unknown>, action: string,
): Promise<void> {
  const admin = await requireAdmin(ctx)
  await ctx.db.patch(id, { ...patch, updated_at: nowIso() } as never)
  await logAudit(ctx, admin._id, action, table, id)
}

export async function adminRemove<T extends TableNames>(
  ctx: MutationCtx, table: T, id: Id<T>, action: string,
): Promise<void> {
  const admin = await requireAdmin(ctx)
  await ctx.db.delete(id)
  await logAudit(ctx, admin._id, action, table, id)
}

/** Intranät-skrivbehörig skapande/uppdatering/borttagning (admin eller medlem utan read-only). */
export async function intranetInsert<T extends TableNames>(
  ctx: MutationCtx, table: T, data: Record<string, unknown>, action: string,
): Promise<Id<T>> {
  const user = await requireIntranetWrite(ctx)
  const now = nowIso()
  const id = await ctx.db.insert(table, { ...data, created_at: data.created_at ?? now, updated_at: data.updated_at ?? now } as never)
  await logAudit(ctx, user._id, action, table, id)
  return id
}

export async function intranetPatch<T extends TableNames>(
  ctx: MutationCtx, table: T, id: Id<T>, patch: Record<string, unknown>, action: string,
): Promise<void> {
  const user = await requireIntranetWrite(ctx)
  await ctx.db.patch(id, { ...patch, updated_at: nowIso() } as never)
  await logAudit(ctx, user._id, action, table, id)
}

export async function intranetRemove<T extends TableNames>(
  ctx: MutationCtx, table: T, id: Id<T>, action: string,
): Promise<void> {
  const user = await requireIntranetWrite(ctx)
  await ctx.db.delete(id)
  await logAudit(ctx, user._id, action, table, id)
}

/** Publikt skapande utan inloggning (kontaktformulär, vittnesmål, FAQ-frågor). Ingen audit — ingen inloggad användare att logga. */
export async function publicInsert<T extends TableNames>(
  ctx: MutationCtx, table: T, data: Record<string, unknown>,
): Promise<Id<T>> {
  const now = nowIso()
  return await ctx.db.insert(table, { ...data, created_at: data.created_at ?? now, updated_at: data.updated_at ?? now } as never)
}

async function logAudit(ctx: MutationCtx, userId: Id<'users'>, action: string, entityType: string, entityId: unknown): Promise<void> {
  await ctx.db.insert('auditLog', {
    user_id: userId, action, entity_type: entityType, entity_id: String(entityId), created_at: nowIso(),
  })
}
