import { describe, expect, it } from 'vitest'
import { MONETAG_DEFAULT_ZONE_ID } from '@/domain/ads/ads'
import { resolveAdProvider } from './ad-provider'

describe('resolveAdProvider', () => {
  /** Zone yang dikirim ke klien harus sama dengan yang dipasang script tag di `app/layout.tsx`, karena fungsi global yang dipanggil klien bernama `show_<zone>` dan `ad_views.block_id` menyimpan nilai ini. Selisih di antara keduanya berarti tiket yang tidak pernah bisa ditayangkan. */
  it('memakai zone Monetag untuk tiket rewarded', () => {
    expect(resolveAdProvider()).toEqual({
      provider: 'monetag',
      unitId: MONETAG_DEFAULT_ZONE_ID,
    })
  })
})
