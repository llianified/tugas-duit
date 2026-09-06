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

/** Tipe `order` dan `count` menambah nilai baru ke enum `captcha_type` lewat migrasi 0050. Yang
 * harus dibuktikan bukan bahwa migrasinya ada, melainkan bahwa jalur aslinya benar-benar bisa
 * menerbitkan, menyimpan, dan membayar soal bertipe itu — kegagalan enum baru muncul di `insert`,
 * jauh dari tempat tipenya ditambahkan. */
describe('TASK-ENUM — tipe soal baru melewati jalur asli sampai dibayar', () => {
  it.each(['order', 'count'] as const)('menerbitkan, menyimpan, dan membayar soal %s', async (tipe) => {
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge, submitAnswer } = await import('./challenge')
    const userId = await makeUser()

    /** Soalnya dipaksa ke tipe yang diuji lewat payload yang dibuat generator asli, karena
     * `issueChallenge` mengundi tipenya sendiri dan menunggu undian jatuh ke satu tipe akan
     * membuat test ini sesekali gagal tanpa ada yang rusak. */
    let challenge = await issueChallenge(userId)
    let percobaan = 0
    while (challenge.type !== tipe && percobaan < 60) {
      await query('update challenges set submitted_at=now() where id=$1', [challenge.id])
      challenge = await issueChallenge(userId)
      percobaan += 1
    }
    expect(challenge.type, `tidak dapat soal ${tipe} dalam ${percobaan} undian`).toBe(tipe)

    /** Baris yang tersimpan harus benar-benar membawa tipe barunya, bukan jatuh ke tipe lain. */
    const tersimpan = await query<{ type: string }>('select type from challenges where id=$1', [
      challenge.id,
    ])
    expect(tersimpan[0].type).toBe(tipe)

    await startChallenge(userId, challenge.id)

    const jawaban =
      challenge.type === 'order'
        ? [...challenge.tiles]
            .sort((a, b) => (challenge.variant === 'descending' ? b - a : a - b))
            .join('-')
        : challenge.type === 'count'
          ? String(
              challenge.options.filter(
                (o) =>
                  o.label.toLowerCase() ===
                  challenge.instruction.replace('Ada berapa ', '').replace(' di papan?', ''),
              ).length,
            )
          : ''

    const hasil = await submitAnswer(userId, challenge.id, jawaban)
    expect(hasil).toMatchObject({ ok: true })
    if (hasil.ok) expect(hasil.reward).toBeGreaterThan(0)

    const selesai = await query<{ type: string }>(
      'select type from task_completions where challenge_id=$1',
      [challenge.id],
    )
    expect(selesai[0].type).toBe(tipe)
  })
})

/** TASK-GASPOL — Pass Gaspol membayar ongkos masuk, bukan hadiahnya.
 *
 * Argumennya sama persis dengan tiket iklan di migrasi 0024: yang dibeli adalah ongkos masuk, jadi
 * yang naik cuma kecepatan user menghabiskan plafonnya sendiri — kolam reward tetap yang mematok
 * berapa yang bisa keluar per hari. Yang dijaga di sini dua hal yang sama-sama menentukan uang:
 * energinya benar-benar tidak terpotong, dan soalnya tidak meninggalkan jejak ongkos yang bisa
 * "dikembalikan" jadi energi gratis. */
describe('TASK-GASPOL — pass membayar ongkos masuk tanpa memotong energi', () => {
  const nyalakanGaspol = async (userId: number) => {
    const { query } = await import('../platform/db')
    await query(
      `update users set gaspol_until = now() + interval '1 hour' where id=$1`,
      [userId],
    )
  }

  const energiUser = async (userId: number) => {
    const { query } = await import('../platform/db')
    const rows = await query<{ energy: number }>('select energy from users where id=$1', [userId])
    return Number(rows[0].energy)
  }

  it('tidak memotong energi selama jendelanya berjalan', async () => {
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser()
    await nyalakanGaspol(userId)

    const sebelum = await energiUser(userId)
    const challenge = await issueChallenge(userId)
    const started = await startChallenge(userId, challenge.id)

    expect(started).toMatchObject({ ok: true, paidBy: 'gaspol' })
    expect(await energiUser(userId)).toBe(sebelum)
  })

  /** Pass dibaca SEBELUM energi dipotong, bukan sebagai jalur mundur setelah energinya habis: yang
   * dibeli "energi tidak berkurang", bukan "boleh main saat energi nol". */
  it('tetap jalan saat energinya kosong', async () => {
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser()
    await query('update users set energy=0 where id=$1', [userId])
    await nyalakanGaspol(userId)

    const challenge = await issueChallenge(userId)
    expect(await startChallenge(userId, challenge.id)).toMatchObject({ ok: true, paidBy: 'gaspol' })
  })

  /** Soal yang tidak memotong apa pun juga tidak boleh punya jejak ongkos: `energy_spent_at` yang
   * telanjur terisi membuat `refundEntry` mencetak energi dari udara untuk soal yang gratis. */
  it('tidak meninggalkan jejak ongkos yang bisa dikembalikan jadi energi', async () => {
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const { refundEntry } = await import('../economy/energy')
    const { transaction } = await import('../platform/db')
    const userId = await makeUser()
    await nyalakanGaspol(userId)

    const challenge = await issueChallenge(userId)
    await startChallenge(userId, challenge.id)

    const rows = await query<{ energy_spent_at: Date | null; ad_view_id: string | null }>(
      'select energy_spent_at, ad_view_id from challenges where id=$1',
      [challenge.id],
    )
    expect(rows[0].energy_spent_at).toBeNull()
    expect(rows[0].ad_view_id).toBeNull()

    const sebelum = await energiUser(userId)
    expect(await transaction((tx) => refundEntry(tx, userId, challenge.id))).toEqual({
      refunded: false,
    })
    expect(await energiUser(userId)).toBe(sebelum)
  })

  it('kembali memotong energi setelah jendelanya lewat', async () => {
    const { query } = await import('../platform/db')
    const { issueChallenge, startChallenge } = await import('./challenge')
    const userId = await makeUser()
    await query(`update users set gaspol_until = now() - interval '1 minute' where id=$1`, [userId])

    const sebelum = await energiUser(userId)
    const challenge = await issueChallenge(userId)

    expect(await startChallenge(userId, challenge.id)).toMatchObject({ ok: true, paidBy: 'energy' })
    expect(await energiUser(userId)).toBe(sebelum - DEFAULT_ECONOMY_CONFIG.energyCostPerTask)
  })
})
