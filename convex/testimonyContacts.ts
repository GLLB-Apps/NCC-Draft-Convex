import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listAdminOnly, getByIdAdminOnly, adminInsert, adminPatch, adminRemove } from './lib/collection'

// PII-delningen (e-post, riktigt namn, intern notering) — admin-läsning
// enbart, aldrig publikt läsbar oavsett vittnesmålets status. Den publika
// skapelsen sker atomiskt via testimonies.submit(), inte create() här (se
// testimonies.ts). create() här används bara av admin (AdminTestimonies.tsx,
// när en kontaktpost saknas och behöver skapas för en befintlig post).
const TABLE = 'testimonyContacts' as const

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listAdminOnly(ctx, TABLE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getByIdAdminOnly(ctx, TABLE, id),
})

export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_testimonyContacts'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_testimonyContacts'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_testimonyContacts'),
})
