import { v } from 'convex/values'
import { mutation } from './_generated/server'
import { requireMember } from './lib/permissions'
import { ConvexError } from 'convex/values'

// 1-till-1-ersättning av Appwrite Storage — motsvarar server/api/uploads.php.
// Convex kan inte validera innehållet INNAN en uppladdning tas emot (filen
// POSTas direkt till URL:en från generateUploadUrl, utanför vår egen
// handler), så samma MIME-vitlista/20MB-gräns som PHP:s UploadsController
// kontrolleras HÄR EFTERÅT i finalize() — en ogiltig fil raderas igen direkt.
const MAX_BYTES = 20 * 1024 * 1024
const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf', 'video/mp4', 'video/webm',
])

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Anropas direkt efter att klienten POSTat filbytes till uploadUrl.
 * Verifierar typ/storlek mot den lagrade metadatan och returnerar en
 * färdig-att-rendera URL-sträng (samma mönster som Appwrites
 * storage.getFileView() — se MIGRATION_PLAN.md §5 angående huruvida
 * ctx.storage.getUrl() är stabil eller utgående, OVERIFIERAT, kontrollera
 * mot aktuell Convex-dokumentation i Fas 1).
 */
export const finalize = mutation({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, { storageId }) => {
    await requireMember(ctx)
    const meta = await ctx.db.system.get(storageId)
    if (meta === null) throw new ConvexError({ code: 'NOT_FOUND', message: 'Filen hittades inte.' })

    const mime = meta.contentType ?? ''
    if (!ALLOWED.has(mime) || meta.size > MAX_BYTES) {
      await ctx.storage.delete(storageId)
      throw new ConvexError({ code: 'VALIDATION_ERROR', message: `Filtypen stöds inte (${mime}) eller är för stor (max 20 MB).` })
    }

    const url = await ctx.storage.getUrl(storageId)
    if (url === null) throw new ConvexError({ code: 'INTERNAL_ERROR', message: 'Kunde inte läsa filens URL.' })
    return url
  },
})
