import { createHmac, randomBytes } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'

const BOT_TOKEN = 'test-bot-token'

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN
  delete process.env.DATABASE_URL
  const { query } = await import('./db')
  await query('select 1')
}, 120_000)

function signInitData(overrides: { authDate?: number; userId?: number } = {}): string {
  const params = new URLSearchParams({
    auth_date: String(overrides.authDate ?? Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: overrides.userId ?? 4_242, first_name: 'Uji' }),
  })
  const data = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()
  params.set('hash', createHmac('sha256', secret).update(data).digest('hex'))
  return params.toString()
}

const freshHash = () => randomBytes(32).toString('hex')

describe('verifyInitData', () => {
  it('memulangkan hash dan authDate supaya payload bisa ditandai sekali pakai', async () => {
    const { verifyInitData } = await import('./telegram')
    const authDate = Math.floor(Date.now() / 1000)
    const result = verifyInitData(signInitData({ authDate }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.authDate).toBe(authDate)
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('menolak payload yang tanda tangannya tidak cocok', async () => {
    const { verifyInitData } = await import('./telegram')
    const tampered = signInitData().replace(/user=[^&]*/, `user=${encodeURIComponent('{"id":1,"first_name":"X"}')}`)
    expect(verifyInitData(tampered)).toEqual({ ok: false, reason: 'bad_hash' })
  })
})

describe('claimInitData', () => {
  it('hanya berhasil pada penukaran pertama', async () => {
    const { claimInitData } = await import('./telegram')
    const hash = freshHash()
    const authDate = Math.floor(Date.now() / 1000)

    expect(await claimInitData(hash, authDate)).toBe(true)
    expect(await claimInitData(hash, authDate)).toBe(false)
    expect(await claimInitData(hash, authDate)).toBe(false)
  })

  it('tepat satu pemenang ketika payload yang sama dikirim bersamaan', async () => {
    const { claimInitData } = await import('./telegram')
    const hash = freshHash()
    const authDate = Math.floor(Date.now() / 1000)

    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimInitData(hash, authDate)),
    )
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('tidak menghalangi payload lain', async () => {
    const { claimInitData } = await import('./telegram')
    const authDate = Math.floor(Date.now() / 1000)
    expect(await claimInitData(freshHash(), authDate)).toBe(true)
    expect(await claimInitData(freshHash(), authDate)).toBe(true)
  })

  it('menyimpan kedaluwarsa pada akhir jendela auth_date, bukan lebih lama', async () => {
    const { claimInitData } = await import('./telegram')
    const { query } = await import('./db')
    const hash = freshHash()
    const authDate = Math.floor(Date.now() / 1000)
    await claimInitData(hash, authDate)

    const { createHash } = await import('node:crypto')
    const rows = await query<{ expires_at: Date }>(
      'select expires_at from used_init_data where hash=$1',
      [createHash('sha256').update(hash).digest()],
    )
    expect(new Date(rows[0].expires_at).getTime()).toBe((authDate + 900) * 1000)
  })
})
