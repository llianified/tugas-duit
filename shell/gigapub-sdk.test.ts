import { afterEach, describe, expect, it } from 'vitest'
import { gigaPubFailureReason, readGigaPubShow, waitForGigaPubShow } from './gigapub-sdk'

const gigaGlobal = globalThis as unknown as { showGiga?: unknown }

afterEach(() => {
  delete gigaGlobal.showGiga
})

describe('Giga.pub SDK adapter', () => {
  it('membaca fungsi global showGiga', async () => {
    const show = async () => 'completed'
    gigaGlobal.showGiga = show

    expect(readGigaPubShow()).toBe(show)
    expect(await waitForGigaPubShow(0)).toBe(show)
  })

  it('menolak nilai global yang bukan fungsi', async () => {
    gigaGlobal.showGiga = 'belum siap'

    expect(readGigaPubShow()).toBeUndefined()
    expect(await waitForGigaPubShow(0)).toBeNull()
  })

  it('meringkas alasan penolakan Promise', () => {
    expect(gigaPubFailureReason(new Error('no fill'))).toBe('no fill')
    expect(gigaPubFailureReason({ message: 'closed' })).toBe('closed')
    expect(gigaPubFailureReason(null)).toBe('')
  })
})
