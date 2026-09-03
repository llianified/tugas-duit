import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  adFailureReason,
  readInitCdTma,
  resetOnclickaSdk,
  waitForOnclickaShow,
} from './onclicka-sdk'

const sdkGlobal = globalThis as unknown as { initCdTma?: unknown }

const SPOT = '6145580'

afterEach(() => {
  delete sdkGlobal.initCdTma
  resetOnclickaSdk()
})

describe('OnClicka SDK adapter', () => {
  it('menyerahkan fungsi show hasil initCdTma untuk spot yang diminta', async () => {
    const show = async () => 'completed'
    const init = vi.fn(async () => show)
    sdkGlobal.initCdTma = init

    expect(readInitCdTma()).toBe(init)
    expect(await waitForOnclickaShow(SPOT, 0)).toBe(show)
    expect(init).toHaveBeenCalledWith({ id: 6_145_580 })
  })

  it('hanya melakukan init sekali walau ditonton berkali-kali', async () => {
    const show = async () => 'completed'
    const init = vi.fn(async () => show)
    sdkGlobal.initCdTma = init

    await waitForOnclickaShow(SPOT, 0)
    await waitForOnclickaShow(SPOT, 0)

    expect(init).toHaveBeenCalledTimes(1)
  })

  it('menolak nilai global yang bukan fungsi', async () => {
    sdkGlobal.initCdTma = 'belum siap'

    expect(readInitCdTma()).toBeUndefined()
    expect(await waitForOnclickaShow(SPOT, 0)).toBeNull()
  })

  /** Init yang gagal tidak boleh mengunci rewarded sampai aplikasi dimuat ulang: SDK bisa saja
   * baru siap beberapa detik kemudian, dan tontonan berikutnya berhak mencoba lagi. */
  it('mencoba init lagi setelah percobaan sebelumnya gagal', async () => {
    sdkGlobal.initCdTma = async () => {
      throw new Error('spot tidak aktif')
    }
    expect(await waitForOnclickaShow(SPOT, 0)).toBeNull()

    const show = async () => 'completed'
    sdkGlobal.initCdTma = async () => show
    expect(await waitForOnclickaShow(SPOT, 0)).toBe(show)
  })

  it('menganggap init tanpa fungsi show sebagai kegagalan', async () => {
    sdkGlobal.initCdTma = async () => undefined

    expect(await waitForOnclickaShow(SPOT, 0)).toBeNull()
  })

  it('meringkas alasan penolakan Promise', () => {
    expect(adFailureReason(new Error('no fill'))).toBe('no fill')
    expect(adFailureReason({ message: 'closed' })).toBe('closed')
    expect(adFailureReason(null)).toBe('')
  })
})
