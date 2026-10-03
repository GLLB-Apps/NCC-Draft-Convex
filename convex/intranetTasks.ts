import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listMemberOnly, getByIdMemberOnly, intranetInsert, intranetPatch, intranetRemove } from './lib/collection'

// Intranätsinnehåll: läsning kräver medlemskap (admin eller intranet_member),
// skrivning kräver intranät-skrivbehörighet (admin, eller medlem utan
// read_only) — se MIGRATION_PLAN.md §2.
const TABLE = 'intranetTasks' as const

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listMemberOnly(ctx, TABLE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getByIdMemberOnly(ctx, TABLE, id),
})

export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => intranetInsert(ctx, TABLE, data, 'create_intranetTasks'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => intranetPatch(ctx, TABLE, id, patch, 'update_intranetTasks'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => intranetRemove(ctx, TABLE, id, 'remove_intranetTasks'),
})
