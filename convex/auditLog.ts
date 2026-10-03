import { v } from 'convex/values'
import { query } from './_generated/server'
import { listAdminOnly } from './lib/collection'

// Admin-läsning enbart. Aldrig klient-skrivbar — rader skapas bara internt
// av collection.ts (adminInsert/adminPatch/adminRemove/intranetInsert/...).
// Implementerat redan nu (billigt via den delade hjälparen), till skillnad
// från PHP-versionen där audit_log fortfarande var 🟡 ofullständig.
const TABLE = 'auditLog' as const

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listAdminOnly(ctx, TABLE, args),
})
