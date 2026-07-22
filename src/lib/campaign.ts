// Kampanjläge för webbplatsens uppmaningar (CTA). Byts i webbplatsinställningar
// och går att växla fram och tillbaka:
//   'petition' → namninsamling: "Skriv under" + antal underskrifter
//   'donate'   → donationsflöde: "Donera", namninsamlingsgrejerna döljs
//
// All publik CTA-yta (hero, sidfot, header, flytande widget) läser detta objekt
// i stället för att peka direkt på petition_url, så växlingen sker på ett ställe.
import type { SiteSettings } from './types'

export type CampaignMode = 'petition' | 'donate'

export interface Campaign {
  mode: CampaignMode
  isDonate: boolean
  /** Var CTA-knappen leder. */
  ctaUrl: string
  /** Knapptext, t.ex. "Skriv under" eller "Donera". */
  ctaLabel: string
  /** Rubrik i CTA-band och widget. */
  headline: string
  /** Kort text i CTA-band och widget. */
  blurb: string
  /** Om namninsamlingsstatistik (antal underskrifter m.m.) ska visas. */
  showSignatures: boolean
}

const DONATE = {
  label: 'Donera',
  headline: 'Stöd initiativet',
  blurb: 'Ditt bidrag hjälper oss att bevaka planerna och nå ut med information om Rögleskogen.',
}
const PETITION = {
  label: 'Skriv under',
  headline: 'Var med och gör skillnad',
  blurb: 'Skriv under namninsamlingen och håll dig uppdaterad om planerna för Rögleskogen.',
}

export function getCampaign(s: SiteSettings | null): Campaign {
  // Saknat läge tolkas som petition, så en oprovisionerad databas beter sig som förr.
  if (s?.campaign_mode === 'donate') {
    return {
      mode: 'donate',
      isDonate: true,
      ctaUrl: s.donate_url || '#',
      ctaLabel: s.donate_button?.trim() || DONATE.label,
      headline: s.donate_title?.trim() || DONATE.headline,
      blurb: s.donate_text?.trim() || DONATE.blurb,
      showSignatures: false,
    }
  }
  return {
    mode: 'petition',
    isDonate: false,
    ctaUrl: s?.petition_url || '#',
    ctaLabel: PETITION.label,
    headline: PETITION.headline,
    blurb: PETITION.blurb,
    showSignatures: true,
  }
}
