import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listStatusGated, getById, adminInsert, adminPatch, adminRemove, type StatusGate } from './lib/collection'

// Publikt läsbar bara när status='published', admin skriver — se MIGRATION_PLAN.md §2.
const TABLE = 'timelineEvents' as const
const GATE: StatusGate = { field: 'status', publicValues: ['published'] }

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listStatusGated(ctx, TABLE, GATE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getById(ctx, TABLE, id),
})

export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_timelineEvents'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_timelineEvents'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_timelineEvents'),
})
