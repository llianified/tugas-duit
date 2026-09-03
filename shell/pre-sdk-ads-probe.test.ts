import { describe, expect, it } from 'vitest'
import {
  ADS_PROBE_SKIP_STORAGE_KEY,
  PRE_SDK_PROBE_GLOBAL,
  preSdkAdsProbeScript,
} from './pre-sdk-ads-probe'

const VALID = { zoneId: '9876543', sdkName: 'show_9876543' }

describe('script probe pre-SDK', () => {
  it('menyertakan zone dan nama SDK yang diminta', () => {
    const script = preSdkAdsProbeScript(VALID)
    expect(script).toContain('"show_9876543"')
    expect(script).toContain('"9876543"')
  })

  it('memasang globalnya dan menyediakan drain untuk probe React', () => {
    const script = preSdkAdsProbeScript(VALID)
    expect(script).toContain(`W.${PRE_SDK_PROBE_GLOBAL}=`)
    expect(script).toContain('drain:function()')
    expect(script).toContain('origin:ORIGIN')
  })

  it('membaca kunci override kill-switch yang sama dengan yang dipakai hook', () => {
    expect(preSdkAdsProbeScript(VALID)).toContain(JSON.stringify(ADS_PROBE_SKIP_STORAGE_KEY))
  })

  /** Script ini masuk lewat `dangerouslySetInnerHTML`, jadi `</script>` di dalamnya akan
   * menutup tag lebih awal dan sisa kodenya bocor sebagai markup. */
  it('tidak pernah memuat penutup script atau kurung sudut', () => {
    const script = preSdkAdsProbeScript(VALID)
    expect(script.toLowerCase()).not.toContain('</script')
    expect(script).not.toContain('<!--')
  })

  it('menolak zone yang bisa keluar dari literal string', () => {
    for (const zoneId of [
      '',
      'a"b',
      "a'b",
      'a`b',
      'a\\b',
      'a</script>b',
      'a b',
      'a;b',
      'a\nb',
    ]) {
      expect(
        preSdkAdsProbeScript({ zoneId, sdkName: `show_${zoneId}` }),
        JSON.stringify(zoneId),
      ).toBe('')
    }
  })

  it('menolak nama SDK yang tidak aman meski zone-nya aman', () => {
    expect(preSdkAdsProbeScript({ zoneId: '123', sdkName: 'show_123"),alert(1),(' })).toBe('')
  })

  /** Bukti bahwa ia hanya instrumentasi: tidak ada jalur yang memanggil `show_*` sendiri,
   * dan tidak ada yang menahan pemanggilan aslinya. */
  it('meneruskan pemanggilan asli tanpa memanggil show sendiri', () => {
    const script = preSdkAdsProbeScript(VALID)
    expect(script).toContain('fn.apply(this,args)')
    expect(script).not.toMatch(/W\.show_/)
  })

  it('menjaga idempotensi kalau script terpasang dua kali', () => {
    expect(preSdkAdsProbeScript(VALID)).toContain(`if(W.${PRE_SDK_PROBE_GLOBAL})return`)
  })

  /** Script ini dikirim sebagai string, jadi tidak ada compiler yang memeriksanya —
   * satu tanda kutip yang salah baru terlihat sebagai error di browser user. Di-parse
   * di sini supaya kesalahan sintaks jatuh saat test, bukan saat runtime. */
  it('menghasilkan JavaScript yang sah', () => {
    const script = preSdkAdsProbeScript(VALID)
    expect(script.length).toBeGreaterThan(0)
    expect(() => new Function(script)).not.toThrow()
  })
})
