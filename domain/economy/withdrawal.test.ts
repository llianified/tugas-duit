import { describe, expect, it } from 'vitest'
import {
  isDraftValid,
  validateWithdrawalDraft,
  withdrawalGatingReason,
  withdrawalRequirements,
} from './withdrawal'

const validDraft = {
  channelId: 'dana',
  accountNumber: '081234567890',
  accountName: 'Budi Santoso',
  amount: '100',
}

describe('withdrawal validation', () => {
  it('accepts a valid draft at the minimum boundary', () => {
    expect(isDraftValid(validateWithdrawalDraft(validDraft, 100))).toBe(true)
  })

  it('rejects an amount above the available balance', () => {
    expect(validateWithdrawalDraft({ ...validDraft, amount: '101' }, 100).amount).toBeTruthy()
  })

  it('rejects malformed and oversized account names', () => {
    expect(validateWithdrawalDraft({ ...validDraft, accountName: 'Budi 123' }, 100).accountName).toBeTruthy()
    expect(validateWithdrawalDraft({ ...validDraft, accountName: 'A'.repeat(101) }, 100).accountName).toBeTruthy()
  })
})

/** Kelayakan yang lolos semua syarat, dipakai sebagai titik nol tiap kasus di bawah. */
const eligible = {
  activeReferralCount: 5,
  requiredActiveReferrals: 5,
  premiumActive: false,
  requiresPremium: false,
  cooldownEndsAt: null,
  cooldownDays: 7,
  cooldownWaived: false,
  processingCount: 0,
}

describe('WD-12 — gerbang formulir penarikan', () => {
  it('membuka formulir saat semua syarat terpenuhi', () => {
    expect(
      withdrawalGatingReason({
        balance: 100,
        hasProcessingWithdrawal: false,
        eligibility: eligible,
      }),
    ).toBeNull()
  })

  /** Bug-nya: pengajuan yang masih `processing` tidak punya cabang gerbang sama sekali. Yang menutupinya cuma `cooldown`, karena `cooldownEndsAt` dihitung dari `max(requested_at)`. Begitu cooldown-nya habis sementara pengajuannya belum diputuskan admin, formulirnya terbuka penuh dan `createPayout` baru menolak di langkah terakhir dengan `WITHDRAWAL_ALREADY_PENDING` — setelah user mengisi nominal, nomor rekening, dan nama pemilik. */
  it('menggerbang pengajuan yang masih diproses walau cooldown-nya sudah habis', () => {
    expect(
      withdrawalGatingReason({
        balance: 100,
        hasProcessingWithdrawal: true,
        eligibility: eligible,
      }),
    ).toBe('processing')
  })

  /** Saldo pengajuan yang berjalan sudah ditahan `withdrawal_hold`, jadi sisa saldonya hampir selalu di bawah minimum. Tanpa urutan ini user dibacakan "nabung dulu" untuk uang yang justru sedang dalam perjalanan. */
  it('menyebut pengajuan berjalan, bukan saldo kurang, saat saldonya sudah ditahan', () => {
    expect(
      withdrawalGatingReason({
        balance: 0,
        hasProcessingWithdrawal: true,
        eligibility: eligible,
      }),
    ).toBe('processing')
  })

  it('mempertahankan urutan alasan yang sudah ada', () => {
    const base = { hasProcessingWithdrawal: false }

    expect(withdrawalGatingReason({ ...base, balance: 0, eligibility: eligible })).toBe('balance')
    expect(withdrawalGatingReason({ ...base, balance: 100, eligibility: null })).toBe('loading')
    expect(
      withdrawalGatingReason({
        ...base,
        balance: 100,
        eligibility: { ...eligible, requiresPremium: true },
      }),
    ).toBe('premium')
    expect(
      withdrawalGatingReason({
        ...base,
        balance: 100,
        eligibility: { ...eligible, activeReferralCount: 0 },
      }),
    ).toBe('referrals')
    expect(
      withdrawalGatingReason({
        ...base,
        balance: 100,
        eligibility: { ...eligible, cooldownEndsAt: Date.now() + 86_400_000 },
      }),
    ).toBe('cooldown')
  })
})

/** Daftar syarat ada supaya seluruh harganya terbaca sejak layar pertama. Yang dijaga di sini:
 * baris premium hanya muncul saat syaratnya menyala — menampilkannya sebagai syarat yang sudah
 * terpenuhi padahal tidak diwajibkan berarti mengiklankan gerbang yang tidak ada. */
describe('withdrawalRequirements', () => {
  const eligibility = {
    activeReferralCount: 5,
    requiredActiveReferrals: 5,
    premiumActive: false,
    requiresPremium: false,
    cooldownEndsAt: null,
    cooldownDays: 7,
    cooldownWaived: false,
    processingCount: 0,
  }

  it('menyembunyikan baris premium saat syaratnya mati', () => {
    const keys = withdrawalRequirements({ balance: 1_000, eligibility }).map((r) => r.key)
    expect(keys).toEqual(['balance', 'referrals'])
  })

  /** Tiga kasus di bawah adalah satu aturan yang sama dilihat dari tiga tahap: daftarnya berhenti
   * di gerbang pertama yang belum tercapai. Ditulis terpisah supaya kegagalannya menyebut tahap
   * mana yang bocor, bukan sekadar "daftarnya salah". */
  it('menyembunyikan referral dan premium selama saldonya belum cukup', () => {
    const list = withdrawalRequirements({
      balance: 0,
      eligibility: { ...eligibility, activeReferralCount: 0, requiresPremium: true },
    })
    expect(list.map((r) => r.key)).toEqual(['balance'])
    expect(list[0].done).toBe(false)
  })

  it('memunculkan referral setelah saldonya cukup, premium masih ditahan', () => {
    const list = withdrawalRequirements({
      balance: 1_000,
      eligibility: { ...eligibility, activeReferralCount: 0, requiresPremium: true },
    })
    expect(list.map((r) => r.key)).toEqual(['balance', 'referrals'])
    expect(list.find((r) => r.key === 'balance')?.done).toBe(true)
  })

  it('memunculkan premium setelah referralnya genap', () => {
    const list = withdrawalRequirements({
      balance: 1_000,
      eligibility: { ...eligibility, requiresPremium: true },
    })
    expect(list.map((r) => r.key)).toEqual(['balance', 'referrals', 'premium'])
    /** Dua yang di atasnya tetap bercentang: daftarnya jejak progres, bukan satu baris berganti. */
    expect(list.slice(0, 2).every((r) => r.done)).toBe(true)
    expect(list[2].done).toBe(false)
  })

  it('menandai premium selesai saat user sudah premium', () => {
    const list = withdrawalRequirements({
      balance: 1_000,
      eligibility: { ...eligibility, requiresPremium: true, premiumActive: true },
    })
    expect(list.every((r) => r.done)).toBe(true)
  })

  it('menyembunyikan baris referral saat targetnya nol', () => {
    const keys = withdrawalRequirements({
      balance: 1_000,
      eligibility: { ...eligibility, requiredActiveReferrals: 0 },
    }).map((r) => r.key)
    expect(keys).toEqual(['balance'])
  })

  it('tetap menyebut syarat saldo saat kelayakan belum termuat', () => {
    const list = withdrawalRequirements({ balance: 0, eligibility: null })
    expect(list[0]).toMatchObject({ key: 'balance', done: false })
  })
})
