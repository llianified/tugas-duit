import { describe, expect, it } from 'vitest'
import { shouldRequestFullscreen } from './telegram-viewport'

/** BotFather punya setelan fullscreen-nya sendiri. Kalau setelan itu menyala, app sudah terbuka
 * fullscreen sebelum satu baris kode kita jalan — dan meminta ulang keadaan yang sudah berlaku
 * menghasilkan satu transisi fullscreen lagi di Telegram Android: `fullscreenChanged` menyala,
 * viewport-nya berubah ukuran, dan SDK iklan yang membaca perubahan itu sebagai tampilan halaman
 * baru punya alasan untuk menembak sekali lagi.
 *
 * Gejalanya cuma di Telegram Android karena di web.telegram.org dan web produksi langsung,
 * dukungan 8.0 tidak pernah terlaporkan — jadi seluruh cabang ini memang tidak pernah jalan. */
describe('shouldRequestFullscreen', () => {
  const base = { enabled: true, isFullscreen: false as boolean | undefined, supportsFullscreen: true }

  it('meminta fullscreen saat app belum fullscreen dan kliennya mendukung', () => {
    expect(shouldRequestFullscreen(base)).toBe(true)
  })

  it('TIDAK meminta ulang saat app sudah fullscreen dari setelan BotFather', () => {
    expect(shouldRequestFullscreen({ ...base, isFullscreen: true })).toBe(false)
  })

  it('tetap meminta saat kliennya belum melaporkan keadaan fullscreen', () => {
    /** `undefined` berarti klien lama yang tidak punya properti itu sama sekali — bukan "sudah
     * fullscreen". Menganggapnya sudah fullscreen akan menghapus fullscreen di klien yang justru
     * membutuhkan permintaannya. */
    expect(shouldRequestFullscreen({ ...base, isFullscreen: undefined })).toBe(true)
  })

  it('tidak meminta di klien yang tidak mendukung Mini Apps 8.0', () => {
    expect(shouldRequestFullscreen({ ...base, supportsFullscreen: false })).toBe(false)
  })

  it('tidak meminta saat saklarnya dimatikan lewat env', () => {
    expect(shouldRequestFullscreen({ ...base, enabled: false })).toBe(false)
    /** Saklar mati menang atas segalanya, termasuk klien yang mendukung dan belum fullscreen. */
    expect(shouldRequestFullscreen({ enabled: false, isFullscreen: false, supportsFullscreen: true })).toBe(false)
  })
})
