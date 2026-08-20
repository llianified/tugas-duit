import type { AdProvider } from '@/domain/ads'
import { env } from './env'

export interface ResolvedAdProvider {
  provider: AdProvider
  /**
   * Identitas unit iklan di jaringan yang dipilih: project ID untuk GigaPub, blockId
   * untuk Adsgram. Nilai ini yang tersimpan di kolom `ad_views.block_id`, jadi baris
   * lama tetap terbaca apa adanya dan asal setiap tayangan bisa dilacak setelah pindah
   * jaringan.
   */
  unitId: string
}

/**
 * GigaPub menang kalau project ID-nya diset; Adsgram jadi jalan pulang yang cukup
 * diaktifkan lewat env tanpa menyentuh kode. Kalau dua-duanya kosong, fitur iklan mati
 * total dan `ads.enabled` dari `/api/session` bernilai false.
 */
export function resolveAdProvider(): ResolvedAdProvider | null {
  const gigapub = env.gigapubProjectIdOrNull
  if (gigapub) return { provider: 'gigapub', unitId: gigapub }

  const adsgram = env.adsgramBlockIdOrNull
  if (adsgram) return { provider: 'adsgram', unitId: adsgram }

  return null
}
