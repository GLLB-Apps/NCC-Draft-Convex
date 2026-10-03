import { action } from './_generated/server'
import { api } from './_generated/api'

// Manuell hämtning av namninsamlingens underskriftsantal från Skrivunder.com
// — motsvarar server/api/signatures.php. INGEN CRON (medvetet bevarat, se
// MIGRATION_PLAN.md §6): admin klickar "Hämta från Skrivunder" i
// Inställningar och sparar sedan som vanligt via siteSettings.update.
// Skrivunder skyddas ibland av Cloudflare, så anropet kan misslyckas — det
// är inget fel i sig, bara ett känt villkor, olöst här precis som i PHP-
// versionen.
export const sync = action({
  args: {},
  handler: async (ctx) => {
    // Actions har ingen direkt ctx.db — requireAdmin (som slår upp
    // users-dokumentet) finns bara för query/mutation-kontext. Samma
    // behörighetskontroll görs här via users.me, som i sin tur är en vanlig
    // query med full ctx.db-åtkomst.
    const me = await ctx.runQuery(api.users.me, {})
    if (me === null || !me.isAdmin) throw new Error('Kräver adminbehörighet.')

    const url = process.env.PETITION_URL
    if (!url) throw new Error('Ingen Skrivunder-URL är konfigurerad (PETITION_URL).')

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
    })
    if (!res.ok) throw new Error(`Kunde inte hämta sidan (HTTP ${res.status}). Skrivunder kan blockera automatiska anrop.`)

    const html = await res.text()
    const match = html.match(/signatureAmount[^>]*>\s*([\d\s ]+)</u)
    if (!match) throw new Error('Kunde inte hitta antalet underskrifter på sidan — sidans struktur kan ha ändrats.')

    return { count: parseInt(match[1].replace(/\D/gu, ''), 10) }
  },
})
