import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listPublic, getById, adminPatch, adminRemove } from './lib/collection'
import { requireAdmin } from './lib/permissions'

// Sidtexter (bakgrund, kontakt, press, m.fl.) — nyckeln är `slug`, inte ett
// separat id. I Appwrite användes slugen rentav SOM dokumentets $id
// (AdminPageEdit.tsx/AdminFooter.tsx skickar `{id: slug, slug, ...}` till
// upsert()); Convex kan inte sätta ett eget primärnyckelvärde, så upsert()
// här slår upp på `slug`-fältet istället och patchar/skapar utifrån det —
// samma knep som PHP-versionens `data/pages/{slug}.json`-filnamn löste det med.
const TABLE = 'pages' as const

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listPublic(ctx, TABLE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getById(ctx, TABLE, id),
})

export const upsert = mutation({
  args: {
    slug: v.string(),
    title: v.optional(v.string()),
    intro: v.optional(v.string()),
    texts: v.optional(v.record(v.string(), v.string())),
    blocks: v.optional(v.array(v.any())),
  },
  handler: async (ctx, { slug, ...fields }) => {
    await requireAdmin(ctx)
    const now = new Date().toISOString()
    const existing = await ctx.db.query(TABLE).withIndex('slug', q => q.eq('slug', slug)).unique()
    if (existing) {
      await ctx.db.patch(existing._id, { ...fields, updated_at: now })
      return existing._id
    }
    return await ctx.db.insert(TABLE, { slug, ...fields, created_at: now, updated_at: now })
  },
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_pages'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_pages'),
})
