// Vercel serverless function: scrapes the Skrivunder petition page for the
// current signature count and writes it to site_settings.signature_count.
// Skrivunder/iPetitions has no public API, so we read the number from the
// page's static HTML (the `signatureAmount` span). Runs on a daily cron
// (see vercel.json) and can be triggered manually from Admin → Inställningar.
import { Client, Databases } from 'node-appwrite'

const PETITION_URL = process.env.PETITION_URL || 'https://www.skrivunder.com/stoppa_ncc_i_skrylle'

// Look like a real browser — the site's bot protection returns 403 for
// obvious bot/unknown user agents.
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
}

// The petition's Cloudflare blocks datacenter IPs (Vercel), so a direct fetch
// often 403s in the cloud. If a scraping API key is provided it routes through
// a residential IP that gets through; otherwise it falls back to a direct fetch.
async function fetchPetitionHtml() {
  const key = process.env.SCRAPERAPI_KEY
  const target = key
    ? `https://api.scraperapi.com/?api_key=${key}&country_code=se&url=${encodeURIComponent(PETITION_URL)}`
    : PETITION_URL
  const resp = await fetch(target, key ? {} : { headers: BROWSER_HEADERS })
  if (!resp.ok) throw new Error(`petition fetch failed (${resp.status})`)
  return await resp.text()
}

export default async function handler(req, res) {
  try {
    const html = await fetchPetitionHtml()

    // <span class="signatureAmount badge ...">718</span>  (may use spaces/nbsp as thousands sep)
    const m = html.match(/class="[^"]*signatureAmount[^"]*"[^>]*>([\d\s., ]+)</i)
    if (!m) return res.status(502).json({ error: 'signature count not found on page' })
    const count = parseInt(m[1].replace(/[^\d]/g, ''), 10)
    if (!Number.isFinite(count)) return res.status(502).json({ error: 'could not parse count' })

    const client = new Client()
      .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT)
      .setProject(process.env.VITE_APPWRITE_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY)
    const databases = new Databases(client)
    const DB = process.env.VITE_APPWRITE_DATABASE_ID || 'main'

    const list = await databases.listDocuments({ databaseId: DB, collectionId: 'site_settings' })
    const doc = list.documents[0]
    if (!doc) return res.status(500).json({ error: 'no site_settings document' })

    await databases.updateDocument({
      databaseId: DB, collectionId: 'site_settings', documentId: doc.$id,
      data: { signature_count: count },
    })

    return res.status(200).json({ count, updatedAt: new Date().toISOString() })
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
