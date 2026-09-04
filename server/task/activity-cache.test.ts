import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getActivityFeed: vi.fn() }))

vi.mock('./activity', () => ({ getActivityFeed: mocks.getActivityFeed }))

const entri = (id: string) => [
  { id, kind: 'perfect' as const, displayName: 'Uji', photoUrl: null, amount: 1, difficulty: 'mudah', at: 0 },
]

beforeEach(async () => {
  vi.useFakeTimers()
  mocks.getActivityFeed.mockReset()
  const { invalidateActivityFeedCache } = await import('./activity-cache')
  invalidateActivityFeedCache()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('AF-1 — umpan aktivitas dilayani dari satu query bersama', () => {
  it('menyatukan cache-miss berbarengan jadi satu query', async () => {
    const { getCachedActivityFeed } = await import('./activity-cache')
    mocks.getActivityFeed.mockResolvedValue(entri('tc-1'))

    const hasil = await Promise.all(Array.from({ length: 50 }, () => getCachedActivityFeed()))

    /** Inti perbaikannya: umpan ini global, jadi 50 pembaca berbarengan tidak boleh berarti 50 kali `union all` + `row_number()` atas `task_completions` dan `withdrawals`. */
    expect(mocks.getActivityFeed).toHaveBeenCalledTimes(1)
    expect(hasil.every((satu) => satu[0].id === 'tc-1')).toBe(true)
  })

  it('memakai ulang hasil selama TTL dan memuat ulang sesudahnya', async () => {
    const { getCachedActivityFeed } = await import('./activity-cache')
    mocks.getActivityFeed.mockResolvedValue(entri('tc-1'))

    await getCachedActivityFeed()
    vi.advanceTimersByTime(19_000)
    await getCachedActivityFeed()
    expect(mocks.getActivityFeed).toHaveBeenCalledTimes(1)

    /** TTL 20 detik ada di bawah `ACTIVITY_POLL_MS` (30 detik), jadi tiap polling klien tetap menemukan data yang baru dimuat — umpannya tidak boleh terlihat diam. */
    vi.advanceTimersByTime(2_000)
    mocks.getActivityFeed.mockResolvedValue(entri('tc-2'))
    const segar = await getCachedActivityFeed()

    expect(mocks.getActivityFeed).toHaveBeenCalledTimes(2)
    expect(segar[0].id).toBe('tc-2')
  })

  it('menyajikan salinan lama saat query gagal sebentar', async () => {
    const { getCachedActivityFeed } = await import('./activity-cache')
    const peringatan = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.getActivityFeed.mockResolvedValue(entri('tc-1'))
    await getCachedActivityFeed()

    vi.advanceTimersByTime(21_000)
    mocks.getActivityFeed.mockRejectedValue(new Error('koneksi lepas'))
    const lama = await getCachedActivityFeed()

    expect(lama[0].id).toBe('tc-1')
    expect(peringatan).toHaveBeenCalled()
  })

  it('melempar error kalau salinan lamanya sudah melewati masa tenggang', async () => {
    const { getCachedActivityFeed } = await import('./activity-cache')
    mocks.getActivityFeed.mockResolvedValue(entri('tc-1'))
    await getCachedActivityFeed()

    /** Batas yang harus ada: cache tidak boleh berubah jadi sumber data yang salah tanpa akhir. Lewat masa tenggang, route menjawab 500 seperti sebelum ada cache. */
    vi.advanceTimersByTime(121_000)
    mocks.getActivityFeed.mockRejectedValue(new Error('database mati'))

    await expect(getCachedActivityFeed()).rejects.toThrow('database mati')
  })

  it('tidak mengunci cache pada kegagalan pertama', async () => {
    const { getCachedActivityFeed } = await import('./activity-cache')
    mocks.getActivityFeed.mockRejectedValueOnce(new Error('gagal sekali'))

    await expect(getCachedActivityFeed()).rejects.toThrow('gagal sekali')

    mocks.getActivityFeed.mockResolvedValue(entri('tc-9'))
    expect((await getCachedActivityFeed())[0].id).toBe('tc-9')
  })
})
