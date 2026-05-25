export type PageType = 'landing-1' | 'landing-2' | 'schedule'

export interface PageConfig {
  type: PageType
  slug: string
  geoLabel: string
}

export interface FunnelFormData {
  // Step 1
  clientName: string
  slug: string
  tecrmId: string
  brandName: string
  phone: string
  pixelId: string
  city: string
  state: string
  stateAbbr: string
  // Step 2
  logoFile?: File
  logoBase64?: string
  logoExt?: string
  webhookUrl: string
  calendarEmbedUrl: string
  // Step 3
  pages: PageConfig[]
  // Step 6
  domain?: string
}

export interface RegistryEntry {
  slug: string
  name: string
  domain: string
  tecrmId: string
  created: string
  pages: { type: PageType; slug: string; url: string }[]
}
