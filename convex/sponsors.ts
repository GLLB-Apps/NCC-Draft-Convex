import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listPublic, getById, adminInsert, adminPatch, adminRemove } from './lib/collection'

// Alltid publikt läsbar, admin skriver — se MIGRATION_PLAN.md §2.
const TABLE = 'sponsors' as const

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listPublic(ctx, TABLE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getById(ctx, TABLE, id),
})

export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_sponsors'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_sponsors'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_sponsors'),
})
