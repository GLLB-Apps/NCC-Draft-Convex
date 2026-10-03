import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listPublic, getById, adminInsert, adminPatch, adminRemove } from './lib/collection'

// Singleton-dokument (en rad), men hanteras annars precis som varje annan
// alltid-publik tabell — AdminSettings.tsx läser raden (får dess id) innan
// den uppdaterar, så den vanliga id-baserade update() räcker.
const TABLE = 'siteSettings' as const

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
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_siteSettings'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_siteSettings'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_siteSettings'),
})
