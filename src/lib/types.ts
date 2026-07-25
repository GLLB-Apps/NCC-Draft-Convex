export type ContentStatus = 'draft' | 'review' | 'published' | 'archived'
export type TestimonyStatus = 'pending' | 'approved' | 'rejected' | 'archived'
export type UserRole = 'superadmin' | 'redaktor' | 'skribent'
export type SenderType = 'ncc' | 'lund_kommun' | 'authority' | 'media' | 'initiative' | 'private'
export type MediaType = 'image' | 'video' | 'map' | 'graphic' | 'press_image'
export type MapPointType = 'work_area' | 'quarry_area' | 'property_border' | 'transport_route' | 'residence_distance' | 'nature_value' | 'walking_trail' | 'observation_point' | 'photo_point' | 'testimony_point'

export interface ContentBlock {
  type: 'heading' | 'paragraph' | 'quote' | 'factbox' | 'warning' | 'image' | 'gallery' | 'video' | 'document_list' | 'links' | 'divider' | 'button' | 'related' | 'sources' | 'comparison' | 'faq' | 'list' | 'cta' | 'resource'
  text?: string
  title?: string
  url?: string
  /** Knapptext för t.ex. resurs-blocket ("Öppna enkäten"). */
  button_label?: string
  items?: string[]
  image_url?: string
  alt_text?: string
  video_url?: string
  links?: { label: string; url: string }[]
  sources?: { label: string; url: string }[]
  rows?: { label: string; value: string }[]
}

export interface SiteSettings {
  id: string
  site_name: string
  site_subtitle: string
  logo_url: string | null
  favicon_url: string | null
  petition_url: string
  /** 'petition' visar namninsamling/underskrifter, 'donate' ersätter med ett donationsflöde. */
  campaign_mode: 'petition' | 'donate'
  donate_url: string | null
  donate_title: string | null
  donate_text: string | null
  donate_button: string | null
  default_share_image: string | null
  contact_email: string | null
  contact_phone: string | null
  social_links: Record<string, string>
  footer_text: string | null
  privacy_text: string | null
  cookie_text: string | null
  status_message: string | null
  status_phase: string | null
  next_important_date: string | null
  signature_count: number
  hero_title: string
  hero_intro: string
  hero_image: string | null
  hero_buttons: HeroButton[]
  background_blocks: ContentBlock[]
}

/** En knapp i heron. `cta: true` följer kampanjläget (namninsamling/donation). */
export interface HeroButton {
  label: string
  url: string
  style: 'primary' | 'secondary'
  cta?: boolean
}

/** Admin-skapad sida som renderas med block-editorn, på toppnivå-adress /slug. */
export interface CustomPage {
  id: string
  slug: string
  title: string
  intro: string | null
  blocks: ContentBlock[]
  status: ContentStatus
  sort_order: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
}

export interface Topic {
  id: string
  title: string
  slug: string
  intro: string | null
  content: ContentBlock[]
  status: ContentStatus
  featured_image: string | null
  icon: string | null
  sort_order: number
  created_by: string | null
  updated_by: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: ContentBlock[]
  featured_image: string | null
  image_caption: string | null
  author: string | null
  status: ContentStatus
  is_pinned: boolean
  seo_title: string | null
  seo_description: string | null
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface Testimony {
  id: string
  title: string | null
  story: string
  author_name: string | null
  is_anonymous: boolean
  email: string | null
  location: string | null
  area_usage: string | null
  featured_image: string | null
  map_lat: number | null
  map_lng: number | null
  status: TestimonyStatus
  consent_publish: boolean
  consent_contact: boolean
  consent_marketing: boolean
  internal_note: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface DocumentItem {
  id: string
  title: string
  description: string | null
  file_url: string | null
  external_url: string | null
  document_date: string | null
  sender: string | null
  sender_type: SenderType | null
  file_type: string | null
  source: string | null
  status: ContentStatus
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface MediaItem {
  id: string
  title: string
  description: string | null
  alt_text: string | null
  photographer: string | null
  media_date: string | null
  location: string | null
  media_type: MediaType
  file_url: string | null
  video_url: string | null
  rights_info: string | null
  is_press_allowed: boolean
  marketing_ok: boolean
  status: ContentStatus
  published_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface MapLocation {
  id: string
  title: string
  description: string | null
  lat: number
  lng: number
  point_type: MapPointType
  /** Valfri Lucide-ikon (kebab-case). Faller tillbaka på punkttypens ikon. */
  icon: string | null
  image_url: string | null
  source: string | null
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

// ---- Intranät -------------------------------------------------------------
// Inloggningsskyddad yta för projektgrupper och aktiva. Åtkomst styrs av
// Appwrite-labeln "member" (eller "admin"), inte av user_roles.

export interface IntranetMember {
  id: string
  user_id: string
  display_name: string | null
  email: string | null
  added_by: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface IntranetNote {
  id: string
  title: string
  body: string | null
  category: string | null
  pinned: boolean
  created_by: string | null
  created_by_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface IntranetTask {
  id: string
  text: string
  done: boolean
  list: string | null
  assignee: string | null
  due_date: string | null
  created_by: string | null
  done_by: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface IntranetNotice {
  id: string
  title: string
  body: string | null
  author: string | null
  author_id: string | null
  pinned: boolean
  created_at: string
  updated_at: string
}

/** Ett hörn i en polygon, [latitud, longitud] — samma ordning som Leaflet. */
export type LatLngTuple = [number, number]

export type MapAreaLineStyle = 'solid' | 'dashed'

export interface MapArea {
  id: string
  title: string
  description: string | null
  /** Linjefärg som hex, t.ex. "#b94a3d". Fyllningen använder samma färg. */
  color: string
  line_style: MapAreaLineStyle
  fill_opacity: number
  /** Valfri Lucide-ikon (kebab-case) som visas i teckenförklaringen. */
  icon: string | null
  /** Yttre ring i ritordning. Stängs automatiskt — upprepa inte första punkten. */
  points: LatLngTuple[]
  sort_order: number
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface TimelineEvent {
  id: string
  event_date: string
  title: string
  description: string | null
  event_type: string | null
  link_url: string | null
  related_document_id: string | null
  image_url: string | null
  status: ContentStatus
  published_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FaqCategory {
  id: string
  name: string
  slug: string
  sort_order: number
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category_id: string | null
  sort_order: number
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  is_public: boolean
  sort_order: number
}

export interface ContactMessage {
  id: string
  name: string
  email: string
  subject: string | null
  message: string
  status: 'unread' | 'read' | 'handled' | 'archived'
  internal_note: string | null
  created_at: string
  updated_at: string
}

export interface InternalDocCategory {
  id: string
  name: string
  sort_order: number
}

export interface InternalDocument {
  id: string
  title: string
  description: string | null
  file_url: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  category_id: string | null
  owner: string | null
  uploaded_by: string | null
  uploaded_by_id: string | null
  created_at: string
  updated_at: string
}

export interface Sponsor {
  id: string
  name: string
  image_url: string | null
  link_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NavigationItem {
  id: string
  label: string
  url: string
  icon: string | null
  sort_order: number
  is_active: boolean
  parent_id: string | null
}

export interface UserProfile {
  id: string
  display_name: string | null
}

export interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}
