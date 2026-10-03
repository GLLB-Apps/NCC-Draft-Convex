import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listStatusGated, getByIdStatusGated, adminInsert, adminPatch, adminRemove, type StatusGate } from './lib/collection'

// Publikt läsbar bara när status='published', admin skriver — se MIGRATION_PLAN.md §2.
const TABLE = 'customPages' as const
const GATE: StatusGate = { field: 'status', publicValues: ['published'] }

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listStatusGated(ctx, TABLE, GATE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getByIdStatusGated(ctx, TABLE, id, GATE),
})

export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_customPages'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_customPages'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_customPages'),
})
