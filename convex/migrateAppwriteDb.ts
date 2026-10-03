// Separat fil UTAN 'use node' — en fil med 'use node' (migrateAppwrite.ts)
// får bara innehålla actions, inga mutationer/queries (upptäckt av den
// riktiga Convex-pushen: "Only actions can be defined in Node.js").
import { v } from 'convex/values'
import { internalMutation } from './_generated/server'

export const insertRow = internalMutation({
  args: { table: v.string(), data: v.any() },
  handler: async (ctx, { table, data }) => await ctx.db.insert(table as any, data),
})

export const patchRow = internalMutation({
  args: { table: v.string(), id: v.string(), patch: v.any() },
  handler: async (ctx, { id, patch }) => await ctx.db.patch(id as any, patch),
})

/** Utvecklingshjälp för att kunna köra om migrateAppwrite:run rent efter en delvis misslyckad körning. */
export const clearTable = internalMutation({
  args: { table: v.string() },
  handler: async (ctx, { table }) => {
    const rows = await ctx.db.query(table as any).collect()
    for (const r of rows) await ctx.db.delete(r._id)
    return rows.length
  },
})
