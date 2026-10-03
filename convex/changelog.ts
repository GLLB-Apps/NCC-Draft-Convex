import { v } from 'convex/values'
import { action } from './_generated/server'
import { api } from './_generated/api'

// Best-effort AI-översättning av commit-rubriker för ändringsloggens
// GitHub-import (ChangelogImport.tsx) — motsvarar server/api/changelog.php.
// Ingen hård AI-beroende: saknas ANTHROPIC_API_KEY, eller går anropet inte
// att nå, returneras rubrikerna oöversatta i stället för ett fel.
export const translateTitles = action({
  args: { subjects: v.array(v.string()) },
  handler: async (ctx, { subjects }) => {
    const me = await ctx.runQuery(api.users.me, {})
    if (me === null || !me.isAdmin) throw new Error('Kräver adminbehörighet.')
    if (subjects.length === 0) throw new Error('subjects krävs.')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { titles: subjects }

    const numbered = subjects.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const prompt = `Översätt varje commit-rubrik till naturlig, kort svenska för en ändringslogg riktad till redaktionen. `
      + `Svara ENDAST med en JSON-array av strängar, exakt ${subjects.length} element i samma ordning som indata — ingen annan text.\n\n${numbered}`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok) return { titles: subjects }
      const data = await res.json()
      const text = data?.content?.[0]?.text
      const parsed = typeof text === 'string' ? JSON.parse(text) : null
      if (Array.isArray(parsed) && parsed.length === subjects.length) return { titles: parsed }
      return { titles: subjects }
    } catch {
      return { titles: subjects }
    }
  },
})
