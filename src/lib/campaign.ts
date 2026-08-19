// Kampanjläge för webbplatsens uppmaningar (CTA). Byts i webbplatsinställningar
// och går att växla fram och tillbaka:
//   'petition' → namninsamling: "Skriv under" + antal underskrifter
//   'donate'   → donationsflöde: "Donera", namninsamlingsgrejerna döljs
//   'consult'  → samråd: "Mejla samrådet", leder vidare till kontaktsidan
//
// All publik CTA-yta (hero, sidfot, header, flytande widget) läser detta objekt
// i stället för att peka direkt på petition_url, så växlingen sker på ett ställe.
import type { SiteSettings } from './types'

export type CampaignMode = 'petition' | 'donate' | 'consult'

export interface Campaign {
  mode: CampaignMode
  /** Var CTA-knappen leder. Börjar den med "/" är målet en sida på webbplatsen. */
  ctaUrl: string
  /** Knapptext, t.ex. "Skriv under", "Donera" eller "Mejla samrådet". */
  ctaLabel: string
  /** Längre variant för breda ytor (sidfotens CTA-band). */
  ctaLabelLong: string
  /** Kort namn på läget, för aria-etiketter och widgetens titel. */
  shortLabel: string
  /** Rubrik i CTA-band och widget. */
  headline: string
  /** Kort text i CTA-band och widget. */
  blurb: string
  /** Om namninsamlingsstatistik (antal underskrifter m.m.) ska visas. */
  showSignatures: boolean
  /** false = mål på egna webbplatsen, renderas med <Link> i stället för ny flik. */
  external: boolean
}

const DONATE = {
  label: 'Donera',
  headline: 'Stöd initiativet',
  blurb: 'Ditt bidrag hjälper oss att bevaka planerna och nå ut med information om Rögleskogen.',
}
const PETITION = {
  label: 'Skriv under',
  labelLong: 'Skriv under namninsamlingen',
  headline: 'Var med och gör skillnad',
  blurb: 'Skriv under namninsamlingen och håll dig uppdaterad om planerna för Rögleskogen.',
}
const CONSULT = {
  label: 'Mejla samrådet',
  headline: 'Säg din mening i samrådet',
  blurb: 'Under samrådet kan du lämna synpunkter på planerna för Rögleskogen. Skriv till oss så hjälper vi dig vidare.',
  url: '/kontakt',
  subject: 'Synpunkt inför samrådet',
}

/** Interna mål (t.ex. /kontakt) navigeras i appen; allt annat öppnas som länk. */
const isInternal = (url: string) => url.startsWith('/')

/** Lägger på ämnesraden som frågeparameter, så kontaktformuläret kan förifyllas. */
function withSubject(url: string, subject: string): string {
  if (!isInternal(url) || !subject) return url
  return url + (url.includes('?') ? '&' : '?') + 'amne=' + encodeURIComponent(subject)
}

export function getCampaign(s: SiteSettings | null): Campaign {
  // Saknat läge tolkas som petition, så en oprovisionerad databas beter sig som förr.
  if (s?.campaign_mode === 'donate') {
    const ctaLabel = s.donate_button?.trim() || DONATE.label
    const ctaUrl = s.donate_url || '#'
    return {
      mode: 'donate',
      ctaUrl,
      ctaLabel,
      ctaLabelLong: ctaLabel,
      shortLabel: 'Donera',
      headline: s.donate_title?.trim() || DONATE.headline,
      blurb: s.donate_text?.trim() || DONATE.blurb,
      showSignatures: false,
      external: !isInternal(ctaUrl),
    }
  }
  if (s?.campaign_mode === 'consult') {
    const ctaLabel = s.consult_button?.trim() || CONSULT.label
    const base = s.consult_url?.trim() || CONSULT.url
    const ctaUrl = withSubject(base, s.consult_subject?.trim() || CONSULT.subject)
    return {
      mode: 'consult',
      ctaUrl,
      ctaLabel,
      ctaLabelLong: ctaLabel,
      shortLabel: 'Samråd',
      headline: s.consult_title?.trim() || CONSULT.headline,
      blurb: s.consult_text?.trim() || CONSULT.blurb,
      showSignatures: false,
      external: !isInternal(ctaUrl),
    }
  }
  const ctaUrl = s?.petition_url || '#'
  return {
    mode: 'petition',
    ctaUrl,
    ctaLabel: PETITION.label,
    ctaLabelLong: PETITION.labelLong,
    shortLabel: 'Namninsamling',
    headline: PETITION.headline,
    blurb: PETITION.blurb,
    showSignatures: true,
    external: !isInternal(ctaUrl),
  }
}
