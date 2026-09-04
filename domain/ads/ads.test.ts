import { afterEach, describe, expect, it } from 'vitest'
import {
  MONETAG_DEFAULT_ZONE_ID,
  adCooldownSecondsLeft,
  adPassUsable,
  adWatchTooShort,
  adOpenRefusal,
  adViewsLeft,
  adsConfigured,
  monetagSdkName,
} from './ads'
import { DEFAULT_ECONOMY_CONFIG, setActiveEconomyConfig, type EconomyConfig } from '../economy/economy-config'

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const withConfig = (patch: Partial<EconomyConfig>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

const NOW = 1_700_000_000_000

const state = (patch: Partial<Parameters<typeof adOpenRefusal>[0]> = {}) => ({
  viewsToday: 0,
  lastOpenedAt: null,
  hasPending: false,
  hasReady: false,
  hasEntryOpen: false,
  ...patch,
})

describe('ADS-0 — konfigurasi provider rewarded', () => {
  /** Zone ini menamai fungsi global yang dipanggil klien (`show_<zone>`), dipasang script tag di `app/layout.tsx`, dan tersimpan sebagai `ad_views.block_id`. Tiga tempat, satu angka — dipatok di sini supaya penggantiannya tidak pernah setengah jalan. */
  it('memakai zone Monetag yang disetujui untuk rewarded maupun in-app', () => {
    expect(MONETAG_DEFAULT_ZONE_ID).toBe('11615417')
    expect(monetagSdkName(MONETAG_DEFAULT_ZONE_ID)).toBe('show_11615417')
  })
})

describe('ADS-1 — adsMaxViewsPerDay 0 adalah tombol mati', () => {
  it('menolak membuka tiket tanpa melihat keadaan lain', () => {
    withConfig({ adsMaxViewsPerDay: 0 })
    expect(adsConfigured()).toBe(false)
    expect(adOpenRefusal(state(), NOW)).toBe('ads_disabled')
  })

  it('menyala lagi begitu plafonnya dinaikkan', () => {
    withConfig({ adsMaxViewsPerDay: 1 })
    expect(adOpenRefusal(state(), NOW)).toBeNull()
  })
})

describe('ADS-2 — plafon harian dan cooldown', () => {
  it('menghitung sisa tayangan dari plafon aktif', () => {
    withConfig({ adsMaxViewsPerDay: 4 })
    expect(adViewsLeft(0)).toBe(4)
    expect(adViewsLeft(3)).toBe(1)
    expect(adViewsLeft(9)).toBe(0)
  })

  it('menolak saat plafon harian habis', () => {
    withConfig({ adsMaxViewsPerDay: 2 })
    expect(adOpenRefusal(state({ viewsToday: 2 }), NOW)).toBe('daily_limit')
  })

  it('menolak selama cooldown belum lewat, lalu melepas', () => {
    withConfig({ adsCooldownSeconds: 120 })
    expect(adOpenRefusal(state({ lastOpenedAt: NOW - 60_000 }), NOW)).toBe('cooling_down')
    expect(adCooldownSecondsLeft(NOW - 60_000, NOW)).toBe(60)
    expect(adOpenRefusal(state({ lastOpenedAt: NOW - 120_000 }), NOW)).toBeNull()
    expect(adCooldownSecondsLeft(NOW - 120_000, NOW)).toBe(0)
  })
})

describe('ADS-3 — stok tidak boleh menumpuk', () => {
  it('menolak tiket baru selama masih ada tiket menganggur', () => {
    expect(adOpenRefusal(state({ hasPending: true }), NOW)).toBe('ticket_open')
  })

  it('menolak tiket baru selama pass yang siap belum dipakai', () => {
    expect(adOpenRefusal(state({ hasReady: true }), NOW)).toBe('pass_ready')
  })

  it('menolak tiket baru selama task yang dibayar tiket masih berjalan', () => {
    expect(adOpenRefusal(state({ hasEntryOpen: true }), NOW)).toBe('entry_open')
  })

  it('mendahulukan task berjalan daripada tiket menganggur', () => {
    expect(adOpenRefusal(state({ hasEntryOpen: true, hasPending: true }), NOW)).toBe('entry_open')
  })
})

describe('ADS-6 — tiket di potret sesi belum tentu masih hidup', () => {
  /** Potret `/api/session` menyebut tiketnya ada sampai muat ulang berikutnya, sementara
   *  tenggatnya terus berjalan. `watchAd` yang memakai "ada tiket di potret" akan menjawab
   *  "sudah punya" untuk tiket yang sudah mati — lalu pemanggilnya mengirim permintaan yang
   *  dijamin ditolak `consumeAdPass` (`state='ready' and expires_at>now()`), tanpa satu
   *  iklan pun ditonton dan tanpa jalan keluar sampai sesinya disegarkan. */
  it('menolak tiket yang tenggatnya sudah lewat', () => {
    expect(adPassUsable({ expiresAt: NOW + 1 }, NOW)).toBe(true)
    expect(adPassUsable({ expiresAt: NOW }, NOW)).toBe(false)
    expect(adPassUsable({ expiresAt: NOW - 1 }, NOW)).toBe(false)
  })

  it('menjawab false saat memang tidak ada tiket', () => {
    expect(adPassUsable(null, NOW)).toBe(false)
    expect(adPassUsable(undefined, NOW)).toBe(false)
  })
})

describe('ADS-7 — lama tontonan minimum benar-benar menahan, bukan cuma dicatat', () => {
  /** Sebelumnya angkanya konstanta `MIN_WATCH_MS` yang hanya menulis sinyal fraud lalu tetap
   *  menerbitkan tiket, jadi "tap iklan lalu back" terdeteksi tapi selalu lolos. Penjaga ini
   *  sengaja tidak menanyakan apa pun ke penyedia iklan: ia berlaku juga saat gerbang postback
   *  mati, dan tetap berlaku kalau penyedia ternyata membayar klik yang langsung ditutup. */
  it('menolak klaim yang datang lebih cepat dari lantainya', () => {
    withConfig({ adsMinWatchSeconds: 10 })
    expect(adWatchTooShort(NOW - 9_999, NOW)).toBe(true)
    expect(adWatchTooShort(NOW - 10_000, NOW)).toBe(false)
    expect(adWatchTooShort(NOW - 30_000, NOW)).toBe(false)
  })

  /** Jam yang mundur tidak boleh jadi tiket gratis. */
  it('membaca selisih negatif sebagai nol, bukan sebagai tontonan panjang', () => {
    withConfig({ adsMinWatchSeconds: 10 })
    expect(adWatchTooShort(NOW + 60_000, NOW)).toBe(true)
  })

  it('nol mematikan penjagaannya sepenuhnya', () => {
    withConfig({ adsMinWatchSeconds: 0 })
    expect(adWatchTooShort(NOW, NOW)).toBe(false)
  })
})
