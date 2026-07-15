// Config for editable "pages" (WordPress-style). Each entry maps a public
// page to its editable static texts (title + intro + extra fields) and
// shortcuts to the dynamic-content managers that live on that page.
export interface PageManageLink { label: string; to: string }

// Extra editable text on a page (beyond title + intro), e.g. form labels.
export interface PageField { key: string; label: string; default: string; multiline?: boolean }

export interface PageConfig {
  slug: string          // document id / key in the `pages` collection
  label: string         // label in the admin
  route: string         // public route
  defaultTitle: string
  defaultIntro: string
  manage: PageManageLink[]
  fields?: PageField[]
  headerless?: boolean  // page has no title/intro header (e.g. the start page)
}

export const PAGES: PageConfig[] = [
  {
    slug: 'hem', label: 'Startsida', route: '/', defaultTitle: 'Startsida', defaultIntro: '', headerless: true,
    manage: [{ label: 'Webbplatsinställningar (hero m.m.)', to: '/admin/inställningar' }],
    fields: [
      { key: 'status_heading', label: 'Status: rubrik', default: 'Aktuell status' },
      { key: 'status_intro', label: 'Status: text', default: 'Översikt över var i processen vi befinner oss.' },
      { key: 'summary_heading', label: 'Sammanfattning: rubrik', default: 'Kort sammanfattning' },
      { key: 'card1_title', label: 'Kort 1: rubrik', default: 'Vad planeras?' },
      { key: 'card1_text', label: 'Kort 1: text', multiline: true, default: 'NCC har informerat om planer på att ansöka om tillstånd för en ny bergtäkt i Rögleskogen mellan Södra Sandby och Dalby i Lunds kommun.' },
      { key: 'card2_title', label: 'Kort 2: rubrik', default: 'Varför väcker det frågor?' },
      { key: 'card2_text', label: 'Kort 2: text', multiline: true, default: 'Boende och naturintresserade har frågor om buller, damm, trafik, naturvärden och påverkan på närmiljö och livsmiljö.' },
      { key: 'card3_title', label: 'Kort 3: rubrik', default: 'Vad händer nu?' },
      { key: 'card3_text', label: 'Kort 3: text', multiline: true, default: 'Processen befinner sig i ett tidigt skede. Information samlas här kontinuerligt. Håll dig uppdaterad via tidslinjen och nyheterna.' },
      { key: 'topics_heading', label: 'Ämnesområden: rubrik', default: 'Ämnesområden' },
      { key: 'topics_intro', label: 'Ämnesområden: text', default: 'Utforska olika aspekter av den planerade bergtäkten.' },
      { key: 'news_heading', label: 'Nyheter: rubrik', default: 'Senaste nytt' },
      { key: 'cta_heading', label: 'Uppmaning: rubrik', default: 'Hjälp till att sprida informationen' },
      { key: 'cta_text', label: 'Uppmaning: text', multiline: true, default: 'Skriv under namninsamlingen, dela informationen eller lämna ditt vittnesmål.' },
    ],
  },
  { slug: 'nyheter', label: 'Nyheter', route: '/nyheter', defaultTitle: 'Nyheter', defaultIntro: 'Senaste information och uppdateringar om planerna.', manage: [{ label: 'Hantera nyheter', to: '/admin/nyheter' }] },
  { slug: 'amnen', label: 'Ämnesområden', route: '/amnen', defaultTitle: 'Ämnesområden', defaultIntro: 'Olika aspekter av den planerade bergtäkten, från naturvärden till buller och trafik.', manage: [{ label: 'Hantera ämnen', to: '/admin/amnen' }] },
  { slug: 'dokument', label: 'Dokument', route: '/dokument', defaultTitle: 'Dokumentarkiv', defaultIntro: 'Handlingar, brev, kartor och underlag kopplade till planerna.', manage: [{ label: 'Hantera dokument', to: '/admin/dokument' }] },
  { slug: 'media', label: 'Media', route: '/media', defaultTitle: 'Media', defaultIntro: 'Bilder, videor, kartor och grafik från området.', manage: [{ label: 'Hantera media', to: '/admin/media' }] },
  {
    slug: 'karta', label: 'Karta', route: '/karta', defaultTitle: 'Karta', defaultIntro: 'Det planerade området och intressanta punkter.',
    manage: [{ label: 'Hantera kartpunkter', to: '/admin/karta' }],
    fields: [
      { key: 'layers_heading', label: 'Rubrik: kartlager', default: 'Kartlager' },
      { key: 'layers_hint', label: 'Kartlager: text', default: 'Tryck på en punkttyp för att visa eller dölja den på kartan.', multiline: true },
    ],
  },
  { slug: 'tidslinje', label: 'Tidslinje', route: '/tidslinje', defaultTitle: 'Tidslinje', defaultIntro: 'Viktiga händelser i processen kring den planerade bergtäkten.', manage: [{ label: 'Hantera tidslinje', to: '/admin/tidslinje' }] },
  {
    slug: 'vittnesmal', label: 'Vittnesmål', route: '/vittnesmal', defaultTitle: 'Vittnesmål', defaultIntro: 'Berättelser och upplevelser från boende och besökare i Rögleskogen.',
    manage: [{ label: 'Hantera vittnesmål', to: '/admin/vittnesmal' }],
    fields: [
      { key: 'list_heading', label: 'Rubrik: publicerade', default: 'Publicerade vittnesmål' },
      { key: 'form_heading', label: 'Rubrik: formulär', default: 'Lämna ett vittnesmål' },
      { key: 'form_intro', label: 'Formulärets ingress', multiline: true, default: 'Ditt vittnesmål granskas av administratörer innan det publiceras. E-postadressen visas aldrig publikt.' },
      { key: 'label_title', label: 'Fält: Rubrik', default: 'Rubrik (valfritt)' },
      { key: 'label_story', label: 'Fält: Berättelse', default: 'Berättelse' },
      { key: 'label_area', label: 'Fält: Områdesanvändning', default: 'Hur använder du området?' },
      { key: 'label_name', label: 'Fält: Namn', default: 'Namn' },
      { key: 'label_location', label: 'Fält: Ort', default: 'Ort' },
      { key: 'label_email', label: 'Fält: E-post', default: 'E-post' },
      { key: 'email_hint', label: 'E-post: hjälptext', default: 'Visas aldrig publikt.' },
      { key: 'anonymous', label: 'Kryssruta: anonym', default: 'Publicera anonymt (namnet visas inte publikt)' },
      { key: 'consent_publish', label: 'Kryssruta: publicering', multiline: true, default: 'Jag godkänner att min berättelse behandlas och kan publiceras på webbplatsen' },
      { key: 'consent_contact', label: 'Kryssruta: kontakt', multiline: true, default: 'Administratörer får kontakta mig via e-post vid behov' },
      { key: 'review_hint', label: 'Granskningstext', multiline: true, default: 'Inskickat material granskas av administratörer före publicering.' },
      { key: 'submit', label: 'Knapptext', default: 'Skicka vittnesmål' },
      { key: 'success', label: 'Tack-meddelande', multiline: true, default: 'Tack! Ditt vittnesmål är inlämnat och väntar på granskning.' },
    ],
  },
  {
    slug: 'fragor-och-svar', label: 'Frågor och svar', route: '/fragor-och-svar', defaultTitle: 'Frågor och svar', defaultIntro: 'Vanliga frågor om den planerade bergtäkten och detta initiativ.',
    manage: [{ label: 'Hantera FAQ', to: '/admin/faq' }],
    fields: [{ key: 'uncategorized_heading', label: 'Rubrik: okategoriserade frågor', default: 'Övrigt' }],
  },
  {
    slug: 'kontakt', label: 'Kontakt', route: '/kontakt', defaultTitle: 'Kontakt',
    defaultIntro: 'Kontakta initiativet för frågor, information eller samarbete.',
    manage: [{ label: 'Kontaktpersoner', to: '/admin/kontakter' }, { label: 'Formulärmeddelanden', to: '/admin/meddelanden' }],
    fields: [
      { key: 'contacts_heading', label: 'Rubrik: kontaktpersoner', default: 'Kontaktpersoner' },
      { key: 'form_heading', label: 'Rubrik: formulär', default: 'Kontaktformulär' },
      { key: 'label_name', label: 'Fältetikett: Namn', default: 'Namn' },
      { key: 'label_email', label: 'Fältetikett: E-post', default: 'E-post' },
      { key: 'label_subject', label: 'Fältetikett: Ämne', default: 'Ämne' },
      { key: 'label_message', label: 'Fältetikett: Meddelande', default: 'Meddelande' },
      { key: 'submit', label: 'Knapptext', default: 'Skicka meddelande' },
      { key: 'success', label: 'Tack-meddelande', default: 'Tack! Ditt meddelande har skickats.', multiline: true },
    ],
  },
  {
    slug: 'press', label: 'Press', route: '/press', defaultTitle: 'Press', defaultIntro: 'Information och material för journalister och media.',
    manage: [],
    fields: [
      { key: 'facts_heading', label: 'Rubrik: fakta', default: 'Fakta i korthet' },
      { key: 'facts', label: 'Fakta (en rad per punkt)', multiline: true, default: 'NCC planerar en ny bergtäkt i Rögleskogen mellan Södra Sandby och Dalby i Lunds kommun.\nProcessen befinner sig i informations- och samrådsskedet.\nEtt medborgarinitiativ har bildats för att samla information och frågor.\nAll information på denna webbplats är exempeldata om inte annat anges.' },
      { key: 'press_heading', label: 'Rubrik: pressmeddelanden', default: 'Aktuella pressmeddelanden' },
      { key: 'docs_heading', label: 'Rubrik: nyckeldokument', default: 'Nyckeldokument' },
      { key: 'contacts_heading', label: 'Rubrik: kontaktpersoner', default: 'Kontaktpersoner' },
      { key: 'images_heading', label: 'Rubrik: pressbilder', default: 'Pressbilder' },
    ],
  },
]

export const pageBySlug = (slug: string) => PAGES.find(p => p.slug === slug)
