import { ONCLICKA_SPOT_ID, type AdProvider } from '@/domain/ads/ads'

export interface ResolvedAdProvider {
  provider: AdProvider
  /** Identitas unit iklan yang disimpan di `ad_views.block_id`; untuk OnClicka nilainya adalah spot ID. */
  unitId: string
}

/** Tiket rewarded selalu memakai OnClicka. Monetag tetap dimuat terpisah khusus interstitial otomatis in-app. */
export function resolveAdProvider(): ResolvedAdProvider {
  return { provider: 'onclicka', unitId: ONCLICKA_SPOT_ID }
}
