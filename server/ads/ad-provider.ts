import { MONETAG_DEFAULT_ZONE_ID, type AdProvider } from '@/domain/ads/ads'

export interface ResolvedAdProvider {
  provider: AdProvider
  /** Identitas unit iklan yang disimpan di `ad_views.block_id`; untuk Monetag nilainya adalah zone ID. */
  unitId: string
}

/** Zone yang sama dipakai tiket rewarded dan interstitial otomatis: satu zone Monetag melayani dua format lewat fungsi global yang sama — `show_<zone>()` polos adalah Rewarded Interstitial, `show_<zone>({ type: 'inApp' })` adalah interstitial otomatis. Dibaca dari env yang sama dengan `app/(miniapp)/layout.tsx` supaya script tag, hook in-app, dan `block_id` yang tersimpan tidak pernah menunjuk zone berbeda. */
export function resolveAdProvider(): ResolvedAdProvider {
  const zoneId = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID
  return { provider: 'monetag', unitId: zoneId }
}
