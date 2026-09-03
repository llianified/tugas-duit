import { GIGAPUB_PROJECT_ID, type AdProvider } from '@/domain/ads/ads'

export interface ResolvedAdProvider {
  provider: AdProvider
  /** Identitas unit iklan yang disimpan di `ad_views.block_id`; untuk Giga.pub nilainya adalah project ID. */
  unitId: string
}

/** Tiket rewarded selalu memakai Giga.pub. Monetag tetap dimuat terpisah khusus interstitial otomatis in-app. */
export function resolveAdProvider(): ResolvedAdProvider {
  return { provider: 'gigapub', unitId: GIGAPUB_PROJECT_ID }
}
