import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import type { Campaign } from '../../lib/campaign'

// CTA-länken som följer kampanjläget. Externa mål (namninsamling, donation)
// öppnas i ny flik som förr; interna mål (samrådsläget → /kontakt) navigerar
// i appen i stället, så besökaren inte får en ny flik på egna webbplatsen.
export default function CampaignLink({
  campaign, className, children, tabIndex,
}: {
  campaign: Campaign
  className?: string
  /** Utelämnas = knappens text från kampanjläget. */
  children?: ReactNode
  tabIndex?: number
}) {
  const label = children ?? campaign.ctaLabel
  if (!campaign.external) {
    return <Link to={campaign.ctaUrl} className={className} tabIndex={tabIndex}>{label}</Link>
  }
  return (
    <a href={campaign.ctaUrl} target="_blank" rel="noopener noreferrer" className={className} tabIndex={tabIndex}>
      {label}
    </a>
  )
}
