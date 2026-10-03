import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { listStatusGated, getByIdStatusGated, adminInsert, adminPatch, adminRemove, publicInsert, type StatusGate } from './lib/collection'

// Publikt läsbar bara när status='published'. Vem som helst kan skapa en
// fråga (FAQ-sidans frågeformulär), men status/answer tvingas server-side —
// en gäst ska aldrig kunna publicera sin egen fråga direkt (motsvarar PHP:s
// DataController-hantering av 'faqItems' i PUBLIC_CREATE).
const TABLE = 'faqItems' as const
const GATE: StatusGate = { field: 'status', publicValues: ['published'] }

export const list = query({
  args: { eq: v.optional(v.any()), order: v.optional(v.any()), limit: v.optional(v.number()) },
  handler: (ctx, args) => listStatusGated(ctx, TABLE, GATE, args),
})

export const get = query({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => getByIdStatusGated(ctx, TABLE, id, GATE),
})

/** Admin: skapa direkt med valfri status. */
export const create = mutation({
  args: { data: v.any() },
  handler: (ctx, { data }) => adminInsert(ctx, TABLE, data, 'create_faqItems'),
})

/** Publikt: frågeformuläret. Tvingar status='draft' och tom answer oavsett vad klienten skickar. */
export const submitQuestion = mutation({
  args: { question: v.string(), category_id: v.optional(v.string()) },
  handler: (ctx, { question, category_id }) =>
    publicInsert(ctx, TABLE, { question, category_id, answer: '', status: 'draft', sort_order: 0 }),
})

export const update = mutation({
  args: { id: v.id(TABLE), patch: v.any() },
  handler: (ctx, { id, patch }) => adminPatch(ctx, TABLE, id, patch, 'update_faqItems'),
})

export const remove = mutation({
  args: { id: v.id(TABLE) },
  handler: (ctx, { id }) => adminRemove(ctx, TABLE, id, 'remove_faqItems'),
})
