// Kampanjläge för webbplatsens uppmaningar (CTA). Byts i webbplatsinställningar
// och går att växla fram och tillbaka:
//   'petition' → namninsamling: "Skriv under" + antal underskrifter
//   'donate'   → donationsflöde: "Donera", namninsamlingsgrejerna döljs
//   'consult'  → samråd: "Mejla samrådet", öppnar besökarens eget mejlprogram
//                med NCC:s samrådsadress ifylld (efter en förklaringsruta)
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
  /**
   * Adressen mejlet går till, utan mailto:. Satt bara när CTA:n är ett
   * mejlutskick — då visas en förklaringsruta innan mejlprogrammet öppnas,
   * i stället för att knappen länkar rakt iväg.
   */
  mailTo: string | null
  /** Ämnesraden som fylls i åt besökaren. Följs åt med mailTo. */
  mailSubject: string | null
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
  blurb: 'Under samrådet kan du lämna synpunkter på planerna för Rögleskogen – direkt till NCC, i ditt eget namn.',
  email: 'samrad.sodrasandby@ncc.se',
  subject: 'Synpunkt inför samrådet – Rögleskogen',
}

/** Interna mål (t.ex. /kontakt) navigeras i appen; allt annat öppnas som länk. */
const isInternal = (url: string) => url.startsWith('/')

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
      mailTo: null,
    mailSubject: null,
    }
  }
  if (s?.campaign_mode === 'consult') {
    const ctaLabel = s.consult_button?.trim() || CONSULT.label
    // consult_url håller mottagaradressen. Äldre inställningar kan innehålla en
    // sidadress från när läget ledde till kontaktsidan — utan @ är det ingen
    // mejladress, och då är standardadressen det som faktiskt fungerar.
    const saved = (s.consult_url ?? '').trim().replace(/^mailto:/i, '')
    const mailTo = saved.includes('@') ? saved : CONSULT.email
    const subject = s.consult_subject?.trim() || CONSULT.subject
    return {
      mode: 'consult',
      ctaUrl: `mailto:${mailTo}?subject=${encodeURIComponent(subject)}`,
      ctaLabel,
      ctaLabelLong: ctaLabel,
      shortLabel: 'Samråd',
      headline: s.consult_title?.trim() || CONSULT.headline,
      blurb: s.consult_text?.trim() || CONSULT.blurb,
      showSignatures: false,
      external: true,
      mailTo,
      mailSubject: subject,
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
    mailTo: null,
    mailSubject: null,
  }
}
