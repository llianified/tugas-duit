import type { AdProvider } from '@/domain/ads/ads'
import { env } from '../platform/env'

export interface ResolvedAdProvider {
  provider: AdProvider
  /** Identitas unit iklan di jaringan yang dipilih: zone ID untuk Monetag. Nilai ini yang tersimpan di kolom `ad_views.block_id`, jadi baris lama (blockId Adsgram, project ID GigaPub) tetap terbaca apa adanya dan asal setiap tayangan bisa dilacak setelah pindah jaringan. */
  unitId: string
}

/** Monetag adalah satu-satunya jaringan sejak migrasi, dan zone-nya punya default di `domain/ads.ts`, jadi fungsi ini praktis tidak pernah mengembalikan null. Bentuk "boleh null" tetap dipertahankan karena `readAdsState`/`openAdTicket` sudah punya jalur `ads_disabled` yang benar, dan itulah pintu yang dipakai kalau nanti ada jaringan yang perlu benar-benar dimatikan dari env. */
export function resolveAdProvider(): ResolvedAdProvider | null {
  const zoneId = env.monetagZoneId
  if (zoneId) return { provider: 'monetag', unitId: zoneId }

  return null
}
