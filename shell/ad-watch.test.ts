import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adFailureMessage, watchAdToFinish, type AdWatchOutcome } from './ad-watch'
import { rewardedPlayer, rewardedShowParams } from './monetag-sdk'

/** Suite berjalan di environment `node`. EventTarget palsu cukup untuk meniru lifecycle visibility Telegram dan membuktikan bahwa watcher tidak lagi menjadikannya hasil tayangan. */
type FakeDocument = EventTarget & { hidden: boolean }

let fakeDocument: FakeDocument

function hide() {
  fakeDocument.hidden = true
  fakeDocument.dispatchEvent(new Event('visibilitychange'))
}

function reveal() {
  fakeDocument.hidden = false
  fakeDocument.dispatchEvent(new Event('visibilitychange'))
}

/** Menyerahkan giliran ke microtask queue tanpa menyentuh timer palsu. */
const flush = () => Promise.resolve().then(() => undefined)

beforeEach(() => {
  vi.useFakeTimers()
  fakeDocument = Object.assign(new EventTarget(), { hidden: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ADWATCH-1 — tayangan yang tuntas dan yang ditolak', () => {
  it('menjawab finished saat promise SDK selesai', async () => {
    const outcome = await watchAdToFinish(async () => 'completed')
    expect(outcome.status).toBe('finished')
  })

  it('meneruskan alasan penolakan apa adanya untuk dipetakan pemanggil', async () => {
    const outcome = await watchAdToFinish(async () => {
      throw new Error('no ads available')
    })
    expect(outcome).toEqual({ status: 'failed', reason: 'no ads available' })
  })

  it('menangkap lemparan sinkron, bukan meneruskannya sebagai TypeError', async () => {
    const outcome = await watchAdToFinish((() => {
      throw new Error('sdk rusak')
    }) as never)
    expect(outcome).toEqual({ status: 'failed', reason: 'sdk rusak' })
  })
})

describe('ADWATCH-2 — lifecycle Telegram WebView', () => {
  it('tidak menganggap hide/show sebagai tayangan batal', async () => {
    let finishAd: () => void = () => {}
    const pending = watchAdToFinish(
      () =>
        new Promise<string>((resolve) => {
          finishAd = () => resolve('completed')
        }),
    )
    let answered = false
    void pending.then(() => {
      answered = true
    })

    hide()
    reveal()
    await vi.advanceTimersByTimeAsync(10_000)

    expect(answered).toBe(false)
    finishAd()
    await expect(pending).resolves.toEqual({ status: 'finished' })
  })

  it('meneruskan penolakan provider setelah aplikasi kembali terlihat', async () => {
    let rejectAd: () => void = () => {}
    const pending = watchAdToFinish(
      () =>
        new Promise<string>((_resolve, reject) => {
          rejectAd = () => reject(new Error('closed by user'))
        }),
    )

    hide()
    reveal()
    await vi.advanceTimersByTimeAsync(10_000)
    rejectAd()

    await expect(pending).resolves.toEqual({ status: 'failed', reason: 'closed by user' })
  })

  it('tetap menerima hasil selesai yang datang segera setelah aplikasi kembali', async () => {
    let finishAd: () => void = () => {}
    const pending = watchAdToFinish(
      () =>
        new Promise<string>((resolve) => {
          finishAd = () => resolve('completed')
        }),
    )

    hide()
    reveal()
    await vi.advanceTimersByTimeAsync(1_000)
    finishAd()
    await flush()
    await vi.advanceTimersByTimeAsync(5_000)

    expect((await pending).status).toBe('finished')
  })

  it('diam saja selama dokumennya tersembunyi', async () => {
    const pending = watchAdToFinish(() => new Promise(() => {}))
    let answered = false
    void pending.then(() => {
      answered = true
    })

    hide()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(answered).toBe(false)
  })
})

describe('ADWATCH-3 — katup darurat', () => {
  it('membebaskan tombol kalau SDK tidak pernah menjawab', async () => {
    const pending = watchAdToFinish(() => new Promise(() => {}))

    await vi.advanceTimersByTimeAsync(180_000)

    expect((await pending).status).toBe('abandoned')
  })

  it('tetap menyerahkan konfirmasi provider yang datang setelah backstop', async () => {
    let finishAd: () => void = () => {}
    const pending = watchAdToFinish(
      () =>
        new Promise<string>((resolve) => {
          finishAd = () => resolve('completed')
        }),
    )

    await vi.advanceTimersByTimeAsync(180_000)
    const outcome = (await pending) as Extract<AdWatchOutcome, { status: 'abandoned' }>
    expect(outcome.status).toBe('abandoned')

    finishAd()
    await expect(outcome.late).resolves.toEqual({ status: 'finished' })
  })
})

describe('ADWATCH-4 — galat yang bisa ditindaklanjuti', () => {
  it.each([
    ['no ads available', 'AD-NO-FILL'],
    ['closed by user', 'AD-CLOSED'],
    ['network timeout', 'AD-NETWORK'],
    ['request blocked', 'AD-BLOCKED'],
    ['unknown provider failure', 'AD-PROVIDER'],
  ])('memetakan alasan "%s" ke kode %s', (reason, code) => {
    expect(adFailureMessage(reason)).toContain(`Kode: ${code}.`)
  })

  it('selalu menjelaskan bahwa tiket belum masuk untuk penolakan tayangan', () => {
    expect(adFailureMessage('unknown provider failure')).toContain('Tiket belum masuk')
  })
})

describe('ADWATCH-5 — konfigurasi rewarded Monetag', () => {
  it('membentuk opsi rewarded eksplisit dengan identitas tiket', () => {
    expect(rewardedShowParams('ticket-123')).toEqual({
      type: 'end',
      ymid: 'ticket-123',
      requestVar: 'task_ticket',
      catchIfNoFeed: true,
    })
  })

  it('mengirim opsi rewarded setiap kali player dijalankan', async () => {
    const show = vi.fn(async () => 'completed')
    const play = rewardedPlayer(show, 'ticket-456')

    await expect(play()).resolves.toBe('completed')
    expect(show).toHaveBeenCalledOnce()
    expect(show).toHaveBeenCalledWith({
      type: 'end',
      ymid: 'ticket-456',
      requestVar: 'task_ticket',
      catchIfNoFeed: true,
    })
  })
})
