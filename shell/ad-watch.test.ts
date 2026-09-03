import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchAdToFinish, type AdWatchOutcome } from './ad-watch'

/** Suite ini jalan di environment `node`, jadi `document`/`window` dipalsukan seadanya. Yang dipakai `watchAdToFinish` cuma pendaftaran event dan `document.hidden`, dan `EventTarget` bawaan Node sudah cukup untuk keduanya — lebih murah daripada menarik jsdom hanya demi dua objek. */
type FakeDocument = EventTarget & { hidden: boolean }

const globals = globalThis as unknown as { document?: unknown; window?: unknown }

let fakeDocument: FakeDocument
let fakeWindow: EventTarget

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
  fakeWindow = new EventTarget()
  globals.document = fakeDocument
  globals.window = fakeWindow
})

afterEach(() => {
  vi.useRealTimers()
  delete globals.document
  delete globals.window
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

describe('ADWATCH-2 — penonton yang pergi lalu kembali', () => {
  it('menyatakan ditinggal kalau tayangannya tidak pernah selesai', async () => {
    const pending = watchAdToFinish(() => new Promise(() => {}))

    hide()
    reveal()
    await vi.advanceTimersByTimeAsync(2_500)

    expect((await pending).status).toBe('abandoned')
  })

  /** Ini yang membuat tebakan "ditinggal" boleh dipakai sama sekali. Dokumen juga tersembunyi saat notifikasi masuk atau layar terkunci; kalau tayangannya diteruskan sampai habis sesudah itu, hasilnya WAJIB tetap sampai ke pemanggil. Tanpa `late`, user menonton iklan penuh lalu tidak dapat tiket — persis kerugian yang sedang dihindari. */
  it('tetap menyerahkan hasil tuntas yang datang setelah dinyatakan ditinggal', async () => {
    let finishAd: () => void = () => {}
    const pending = watchAdToFinish(
      () =>
        new Promise<string>((resolve) => {
          finishAd = () => resolve('completed')
        }),
    )

    hide()
    reveal()
    await vi.advanceTimersByTimeAsync(2_500)

    const outcome = (await pending) as Extract<AdWatchOutcome, { status: 'abandoned' }>
    expect(outcome.status).toBe('abandoned')

    finishAd()
    await expect(outcome.late).resolves.toEqual({ status: 'finished' })
  })

  it('tidak menyatakan ditinggal kalau tayangannya selesai di dalam jeda kepulangan', async () => {
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

  it('diam saja selama dokumennya belum kembali', async () => {
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
  it('membebaskan tombol kalau SDK tidak pernah menjawab dan dokumennya tidak pernah pergi', async () => {
    const pending = watchAdToFinish(() => new Promise(() => {}))

    await vi.advanceTimersByTimeAsync(180_000)

    expect((await pending).status).toBe('abandoned')
  })
})
