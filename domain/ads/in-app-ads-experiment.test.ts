import { describe, expect, it } from 'vitest'
import { skipExplicitInAppShow } from './in-app-ads-experiment'

describe('saklar eksperimen in-app', () => {
  it('mati saat tidak ada env dan tidak ada override', () => {
    expect(skipExplicitInAppShow({})).toBe(false)
    expect(skipExplicitInAppShow({ env: undefined, override: undefined })).toBe(false)
    expect(skipExplicitInAppShow({ env: null, override: null })).toBe(false)
  })

  it('mati untuk nilai yang tidak dikenal, bukan menyala karena string non-kosong', () => {
    for (const value of ['', ' ', 'ya', 'yes', 'enabled', 'skip', '2']) {
      expect(skipExplicitInAppShow({ env: value }), value).toBe(false)
    }
  })

  it('menyala hanya untuk nilai yang eksplisit', () => {
    for (const value of ['1', 'true', 'TRUE', 'on', ' 1 ']) {
      expect(skipExplicitInAppShow({ env: value }), value).toBe(true)
    }
  })

  it('membaca nilai penolakan sebagai mati', () => {
    for (const value of ['0', 'false', 'off']) {
      expect(skipExplicitInAppShow({ env: value }), value).toBe(false)
    }
  })

  /** Perangkat uji harus selalu bisa dikembalikan ke perilaku normal tanpa deploy ulang,
   * jadi override menang di KEDUA arah. */
  it('mendahulukan override atas env di kedua arah', () => {
    expect(skipExplicitInAppShow({ env: '0', override: '1' })).toBe(true)
    expect(skipExplicitInAppShow({ env: '1', override: '0' })).toBe(false)
  })

  it('mengabaikan override yang tidak dikenal dan kembali ke env', () => {
    expect(skipExplicitInAppShow({ env: '1', override: 'entah' })).toBe(true)
    expect(skipExplicitInAppShow({ env: '0', override: '' })).toBe(false)
  })
})
