import { ConvexError } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import type { QueryCtx, MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

// Direkt port av server/lib/Auth.php requireUser/requireAdmin/requireSuperadmin/
// requireMember/requireIntranetWrite — samma tre behörighetsaxlar som i PHP-
// versionen (och innan det, Appwrites account-label-modell), bara uttryckta
// mot Convex Auths users-dokument istället för en SQLite-rad.
//
// Inget CSRF-motsvarighet behövs — Convex's bearer-token-modell har ingen
// cookie-ambient auth att förfalska (se MIGRATION_PLAN.md §3).

type Ctx = QueryCtx | MutationCtx

export async function currentUser(ctx: Ctx): Promise<Doc<'users'> | null> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) return null
  return await ctx.db.get(userId)
}

export async function requireUser(ctx: Ctx): Promise<Doc<'users'>> {
  const user = await currentUser(ctx)
  if (user === null) throw new ConvexError({ code: 'UNAUTHENTICATED', message: 'Inloggning krävs.' })
  return user
}

/** role !== undefined — paritet med isAdmin i auth.tsx. */
export async function requireAdmin(ctx: Ctx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role === undefined) throw new ConvexError({ code: 'FORBIDDEN', message: 'Kräver adminbehörighet.' })
  return user
}

export async function requireSuperadmin(ctx: Ctx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role !== 'superadmin') throw new ConvexError({ code: 'FORBIDDEN', message: 'Kräver superadmin.' })
  return user
}

/** isAdmin || intranet_member — paritet med isMember i auth.tsx. */
export async function requireMember(ctx: Ctx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  if (user.role === undefined && user.intranet_member !== true) {
    throw new ConvexError({ code: 'FORBIDDEN', message: 'Kräver intranätsåtkomst.' })
  }
  return user
}

/** isAdmin || (intranet_member && !intranet_read_only) — canWriteIntranet. */
export async function requireIntranetWrite(ctx: Ctx): Promise<Doc<'users'>> {
  const user = await requireUser(ctx)
  const canWrite = user.role !== undefined || (user.intranet_member === true && user.intranet_read_only !== true)
  if (!canWrite) throw new ConvexError({ code: 'FORBIDDEN', message: 'Skrivskyddad intranätsåtkomst.' })
  return user
}

export function isAdmin(user: Doc<'users'> | null): boolean {
  return user !== null && user.role !== undefined
}

export function isMember(user: Doc<'users'> | null): boolean {
  return user !== null && (isAdmin(user) || user.intranet_member === true)
}

export function canWriteIntranet(user: Doc<'users'> | null): boolean {
  return user !== null && (isAdmin(user) || (user.intranet_member === true && user.intranet_read_only !== true))
}
