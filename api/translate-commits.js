// Vercel serverless function: översätter commit-rubriker till svenska inför
// importen till ändringsloggen.
//
// Commit-meddelandena skrivs på engelska för utvecklare, men ändringsloggen
// läses av redaktionen på svenska. Hela listan översätts i ETT anrop i stället
// för ett per rad — billigare, snabbare, och modellen ser hela sammanhanget.
//
// ANTHROPIC_API_KEY sätts som miljövariabel i Vercel och får aldrig ligga bakom
// VITE_-prefixet: allt med det prefixet bakas in i klientbygget och är publikt.
//
// Anroparen bevisar sig med en kortlivad Appwrite-JWT och måste ha admin-labeln.
// Utan den kontrollen vore det här en öppen endpoint som kostar pengar per
// anrop — och repot är publikt, så adressen är känd.
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { Client, Account, Users } from 'node-appwrite'

// Taket håller ett anrop litet nog att svara inom funktionens tidsgräns.
const MAX_SUBJECTS = 100

const SYSTEM = `Du översätter commit-rubriker till svenska för en ändringslogg som läses av
redaktionen på en svensk webbplats – inte av utvecklare.

Regler:
- Är rubriken redan på svenska: returnera den ordagrant, oförändrad.
- Översätt annars till naturlig svenska. Översätt inte ord för ord – skriv om så
  att en icke-teknisk läsare förstår vad som ändrades.
- Behåll det som är egennamn: NCC, Rögleskogen, Appwrite, PDF, HEIC, Skrivunder.
- En rad, ingen avslutande punkt, inga citattecken, ingen inledande versal-jargong
  som "Feat:" eller "Fix:".
- Håll dig kort – gärna under 80 tecken.
- Returnera exakt lika många rader som du fick, i samma ordning.`

const Output = z.object({
  titles: z.array(z.string()).describe('De översatta rubrikerna, i samma ordning som indata.'),
})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoden stöds inte.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const subjects = Array.isArray(body.subjects) ? body.subjects.filter(s => typeof s === 'string' && s.trim()) : []
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim()

  if (!jwt) return res.status(401).json({ error: 'Saknar token' })
  if (subjects.length === 0) return res.status(400).json({ error: 'subjects (en lista med rubriker) krävs' })
  if (subjects.length > MAX_SUBJECTS) {
    return res.status(400).json({ error: `Högst ${MAX_SUBJECTS} rubriker per anrop.` })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Översättning är inte konfigurerad (ANTHROPIC_API_KEY saknas).' })
  }

  const endpoint = process.env.VITE_APPWRITE_ENDPOINT
  const project = process.env.VITE_APPWRITE_PROJECT_ID

  // 1) Vem anropar? Verifiera JWT:n med anroparens egen klient.
  let callerId
  try {
    const userClient = new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt)
    callerId = (await new Account(userClient).get()).$id
  } catch {
    return res.status(401).json({ error: 'Ogiltig eller utgången session' })
  }

  // 2) Admin-labeln är gränsen – samma som för allt annat skrivande.
  try {
    const adminClient = new Client().setEndpoint(endpoint).setProject(project).setKey(process.env.APPWRITE_API_KEY)
    const labels = (await new Users(adminClient).get({ userId: callerId })).labels || []
    if (!labels.includes('admin')) {
      return res.status(403).json({ error: 'Kräver administratörsbehörighet' })
    }
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) })
  }

  // 3) Översätt hela listan i ett anrop.
  try {
    const client = new Anthropic()
    const numbered = subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      system: SYSTEM,
      // Låg ansträngning räcker för korta översättningar och håller kostnaden
      // nere. Tänkandet lämnas påslaget – att stänga av det på Opus 5 har egna
      // felmoder och sparar mindre än effort-sänkningen gör.
      output_config: { effort: 'low', format: zodOutputFormat(Output) },
      messages: [{ role: 'user', content: `Översätt de här ${subjects.length} rubrikerna:\n\n${numbered}` }],
    })

    const titles = response.parsed_output?.titles
    if (!Array.isArray(titles) || titles.length !== subjects.length) {
      // Hellre originalrubrikerna än fel rubrik på fel rad.
      return res.status(200).json({ titles: subjects, translated: false })
    }
    return res.status(200).json({ titles, translated: true })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Översättningstjänsten är tillfälligt överbelastad. Försök igen om en stund.' })
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY är ogiltig.' })
    }
    return res.status(500).json({ error: e?.message || String(e) })
  }
}
