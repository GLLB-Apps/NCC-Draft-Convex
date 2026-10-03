import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listStatusGated, getByIdStatusGated, adminInsert, adminPatch, adminRemove, publicInsert, type StatusGate } from './lib/collection'

// Publikt läsbar bara när status='approved'. Den publika inlämningen
// (TestimoniesPage.tsx) går INTE via create() här — den anropar submit()
// nedan direkt, som skriver testimonies + testimonyContacts atomiskt i en
// transaktion (en förbättring jämfört med både Appwrite- och PHP-versionen,
// som gjorde två sekventiella inserts — se MIGRATION_PLAN.md §2).
const TABLE = 'testimonies' as const
const GATE: StatusGate = { field: 'status', publicValues: ['approved'] }

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listStatusGated(ctx, TABLE, GATE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getByIdStatusGated(ctx, TABLE, id, GATE),
})

/** Admin-enbart — den publika vägen är submit() nedan. */
export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_testimonies'),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_testimonies'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_testimonies'),
})

/** Publik inlämning: vittnesmålet + kontaktuppgifterna i en atomisk transaktion. */
export const submit = mutation({
  args: {
    title: v.optional(v.string()),
    story: v.string(),
    is_anonymous: v.boolean(),
    location: v.optional(v.string()),
    area_usage: v.optional(v.string()),
    featured_image: v.optional(v.string()),
    map_lat: v.optional(v.number()),
    map_lng: v.optional(v.number()),
    consent_publish: v.boolean(),
    consent_contact: v.boolean(),
    consent_marketing: v.boolean(),
    contact_email: v.optional(v.string()),
    contact_author_name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { contact_email, contact_author_name, ...fields } = args
    const testimonyId = await publicInsert(ctx, TABLE, { ...fields, status: 'pending' })
    await publicInsert(ctx, 'testimonyContacts', {
      testimony_id: testimonyId, email: contact_email, author_name: contact_author_name,
    })
    return testimonyId
  },
})
