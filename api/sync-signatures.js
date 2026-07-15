// Vercel serverless function: scrapes the Skrivunder petition page for the
// current signature count and writes it to site_settings.signature_count.
// Skrivunder/iPetitions has no public API, so we read the number from the
// page's static HTML (the `signatureAmount` span). Runs on a daily cron
// (see vercel.json) and can be triggered manually from Admin → Inställningar.
import { Client, Databases } from 'node-appwrite'

const PETITION_URL = process.env.PETITION_URL || 'https://www.skrivunder.com/stoppa_ncc_i_skrylle'

export default async function handler(req, res) {
  try {
    const resp = await fetch(PETITION_URL, {
      headers: { 'User-Agent': 'RogleskogenBot/1.0 (+https://ncc-draft-rs.vercel.app)' },
    })
    if (!resp.ok) return res.status(502).json({ error: `petition fetch failed (${resp.status})` })
    const html = await resp.text()

    // <span class="signatureAmount badge ...">718</span>  (may use spaces/nbsp as thousands sep)
    const m = html.match(/class="[^"]*signatureAmount[^"]*"[^>]*>([\d\s .,]+)</i)
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
