import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_ECONOMY_CONFIG,
  setActiveEconomyConfig,
  type EconomyConfig,
} from '@/domain/economy/economy-config'
import { getStarCutoffs } from '@/domain/progression/stars'
import { generateChallenge } from '@/domain/task/challenge'

beforeAll(async () => {
  delete process.env.DATABASE_URL
  const { query } = await import('../platform/db')
  await query('select 1')
}, 120_000)

afterEach(() => setActiveEconomyConfig(DEFAULT_ECONOMY_CONFIG))

const withConfig = (patch: Partial<EconomyConfig>) =>
  setActiveEconomyConfig({ ...DEFAULT_ECONOMY_CONFIG, ...patch })

async function makeUser(): Promise<number> {
  const { query } = await import('../platform/db')
  const { generateReferralCode } = await import('../economy/referral')
  const suffix = Math.floor(Math.random() * 1_000_000_000)
  const rows = await query<{ id: string }>(
    `insert into users(telegram_id,first_name,referral_code,energy)
     values($1,'Uji',$2,5) returning id`,
    [400_000_000_000_000 + suffix, generateReferralCode()],
  )
  return Number(rows[0].id)
}

describe('TASK-1 — bentuk soal mengikuti konfigurasi', () => {
  it('panjang teks mengikuti textLength per tingkat', () => {
    withConfig({ textLengthEasy: 3, textLengthHard: 9 })
    const easy = generateChallenge({ type: 'text', difficulty: 'Easy' })
    const hard = generateChallenge({ type: 'text', difficulty: 'Hard' })
    expect(easy.type === 'text' && easy.display.length).toBe(3)
    expect(hard.type === 'text' && hard.display.length).toBe(9)
  })

  it('jumlah pilihan bentuk mengikuti selectOptions per tingkat', () => {
    withConfig({ selectOptionsEasy: 2, selectOptionsMedium: 7 })
    const easy = generateChallenge({ type: 'select', difficulty: 'Easy' })
    const medium = generateChallenge({ type: 'select', difficulty: 'Medium' })
    expect(easy.type === 'select' && easy.options.length).toBe(2)
    expect(medium.type === 'select' && medium.options.length).toBe(7)
  })

  it('digit jawaban Hitung mengikuti mathDigits dan batas hasilnya', () => {
    withConfig({ mathDigitsEasy: 1, mathCeilingEasy: 9 })
    for (let i = 0; i < 25; i += 1) {
      const soal = generateChallenge({ type: 'math', difficulty: 'Easy' })
      if (soal.type !== 'math') throw new Error('tipe soal tidak sesuai')
      expect(soal.answerLength).toBe(1)
      expect(Number(soal.answer)).toBeLessThanOrEqual(9)
      expect(Number(soal.answer)).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('TASK-2 — batas bintang mengikuti star2ParMultiplier', () => {
  it('menggeser ambang 2 bintang tanpa menyentuh ambang 3 bintang', () => {
    withConfig({ parTimeEasyMs: 10_000, star2ParMultiplier: 3 })
    expect(getStarCutoffs('Easy')).toEqual({ 3: 10_000, 2: 30_000 })
  })
})

describe('TASK-3 — percobaan dan jendela waktu mengikuti konfigurasi', () => {
  it('menutup soal tepat setelah maxAttemptsPerTask jawaban salah', async () => {
    const { issueChallenge, startChallenge, submitAnswer } = await import('./challenge')
    withConfig({ maxAttemptsPerTask: 2 })
    const userId = await makeUser()
    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id)

    const first = await submitAnswer(userId, challenge.id, 'JAWABAN-SALAH-1')
    expect(first).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: 1 })

    const second = await submitAnswer(userId, challenge.id, 'JAWABAN-SALAH-2')
    expect(second).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: 0 })

    const third = await submitAnswer(userId, challenge.id, 'JAWABAN-SALAH-3')
    expect(third).toMatchObject({ ok: false, reason: 'already_submitted' })
  })

  it('memakai taskWindowSeconds sebagai umur soal', async () => {
    const { query } = await import('../platform/db')
    const { issueChallenge } = await import('./challenge')
    withConfig({ taskWindowSeconds: 90 })
    const userId = await makeUser()
    const challenge = await issueChallenge(userId)

    const rows = await query<{ umur: number }>(
      'select (extract(epoch from(expires_at-issued_at)))::int umur from challenges where id=$1',
      [challenge.id],
    )
    expect(rows[0].umur).toBe(90)
  })
})
