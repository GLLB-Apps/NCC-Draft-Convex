import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listAdminOnly, getByIdAdminOnly, adminPatch, adminRemove } from './lib/collection'

// Admin-läsning enbart. Den publika skapelsen sker via contact.ts: submit()
// (en action, inte denna mutation — kontaktformuläret behöver mejlutskick
// och honeypot/valideringslogik, se server/api/contact.php-motsvarigheten).
// Här finns bara det adminpanelen (AdminMessages.tsx) behöver: lista, läsa
// och ändra status/intern notering.
const TABLE = 'contactMessages' as const

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listAdminOnly(ctx, TABLE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getByIdAdminOnly(ctx, TABLE, id),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_contactMessages'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_contactMessages'),
})
