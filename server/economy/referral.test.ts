import type { PoolClient } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXT_CHARS } from '@/domain/task/challenge'

const mocks = vi.hoisted(() => ({
  appendLedger: vi.fn(),
  consumeCommissionQuota: vi.fn(),
  commissionUnitsForReward: vi.fn(() => 25),
  splitUnitsIntoCredits: vi.fn(() => ({ credits: 2, remainderUnits: 5 })),
}))

vi.mock('@/domain/economy/referral', () => ({
  commissionUnitsForReward: mocks.commissionUnitsForReward,
  splitUnitsIntoCredits: mocks.splitUnitsIntoCredits,
}))
vi.mock('./ledger', () => ({ appendLedger: mocks.appendLedger }))
vi.mock('./quota', () => ({ consumeCommissionQuota: mocks.consumeCommissionQuota }))

import { accrueCommission, bindUpline, generateReferralCode } from './referral'

const client = (implementation: (sql: string) => unknown) =>
  ({ query: vi.fn((sql: string) => Promise.resolve(implementation(sql))) }) as unknown as PoolClient

describe('referral server', () => {
  beforeEach(() => vi.clearAllMocks())

  it('menghasilkan kode delapan karakter dari alfabet challenge', () => {
    const code = generateReferralCode()

    expect(code).toHaveLength(8)
    expect([...code].every((character) => TEXT_CHARS.includes(character))).toBe(true)
  })

  it('tidak mengikat user kepada dirinya sendiri', async () => {
    const tx = client((sql) =>
      sql.startsWith('select') ? { rows: [{ id: '7', referred_by: null }] } : { rows: [] },
    )

    await bindUpline(tx, { userId: 7, code: ' abc ' })

    expect(tx.query).toHaveBeenCalledOnce()
    expect(tx.query).toHaveBeenCalledWith(expect.stringContaining('referral_code=$1'), ['ABC'])
  })

  it('berhenti saat completion yang sama sudah pernah dicatat', async () => {
    const tx = client((sql) => {
      if (sql.includes('from users d')) return { rows: [{ upline_id: '3', premium_until: null, now: new Date() }] }
      if (sql.startsWith('insert into referral_commissions')) return { rows: [] }
      throw new Error(`Query tidak diharapkan: ${sql}`)
    })

    await accrueCommission(tx, { downlineId: 8, completionId: 'completion-1', reward: 5 })

    expect(mocks.consumeCommissionQuota).not.toHaveBeenCalled()
    expect(mocks.appendLedger).not.toHaveBeenCalled()
  })

  it('mencatat ledger hanya sebesar komisi yang lolos quota', async () => {
    const tx = client((sql) => {
      if (sql.includes('from users d')) return { rows: [{ upline_id: '3', premium_until: null, now: new Date() }] }
      if (sql.startsWith('insert into referral_commissions')) return { rows: [{ id: 'commission-1' }] }
      if (sql.startsWith('insert into referral_wallets')) return { rows: [{ pending_units: 0 }] }
      return { rows: [] }
    })
    mocks.consumeCommissionQuota.mockResolvedValue(1)
    mocks.appendLedger.mockResolvedValue({ ledgerId: 'ledger-1' })

    await accrueCommission(tx, { downlineId: 8, completionId: 'completion-1', reward: 5 })

    /** Argumen keempat adalah premium UPLINE, dan ia harus ikut sampai ke quota: persen komisinya
     * boleh naik, tapi kalau plafon hariannya tetap plafon biasa kenaikan itu tertelan tanpa jejak. */
    expect(mocks.consumeCommissionQuota).toHaveBeenCalledWith(tx, 3, 2, false)
    expect(mocks.appendLedger).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userId: 3, amount: 1, idempotencyKey: 'commission:commission-1' }),
    )
    expect(tx.query).toHaveBeenLastCalledWith(
      expect.stringContaining('settled_ledger_id=$2'),
      ['commission-1', 'ledger-1'],
    )
  })

  /** Premium yang menentukan laju komisi adalah premium UPLINE, dan ia dibaca dari baris yang sama
   * dengan id uplinenya — satu potret waktu untuk laju dan plafon sekaligus. Yang diuji di sini
   * penyalurannya, bukan aritmetikanya: `commissionUnitsForReward` di-mock, jadi kegagalan di sini
   * berarti flag-nya berhenti di tengah jalan, tepat mode kegagalan yang membuat pembeli premium
   * dibayar dengan laju biasa tanpa satu layar pun yang menyatakannya. */
  it('membayar upline premium dengan laju dan plafon premium', async () => {
    const besok = new Date(Date.now() + 86_400_000)
    const tx = client((sql) => {
      if (sql.includes('from users d')) {
        return { rows: [{ upline_id: '3', premium_until: besok, now: new Date() }] }
      }
      if (sql.startsWith('insert into referral_commissions')) return { rows: [{ id: 'commission-9' }] }
      if (sql.startsWith('insert into referral_wallets')) return { rows: [{ pending_units: 0 }] }
      return { rows: [] }
    })
    mocks.consumeCommissionQuota.mockResolvedValue(2)
    mocks.appendLedger.mockResolvedValue({ ledgerId: 'ledger-9' })

    await accrueCommission(tx, { downlineId: 8, completionId: 'completion-9', reward: 5 })

    expect(mocks.commissionUnitsForReward).toHaveBeenCalledWith(5, true)
    expect(mocks.consumeCommissionQuota).toHaveBeenCalledWith(tx, 3, 2, true)
  })

  /** Premium yang sudah lewat tanggalnya bukan premium. Dibaca dari `now()` milik database, bukan
   * jam proses Node — dua-duanya ada di baris yang sama justru supaya perbandingannya tidak pernah
   * menyeberang sumber waktu. */
  it('tidak memakai laju premium saat premium uplinenya sudah habis', async () => {
    const kemarin = new Date(Date.now() - 86_400_000)
    const tx = client((sql) => {
      if (sql.includes('from users d')) {
        return { rows: [{ upline_id: '3', premium_until: kemarin, now: new Date() }] }
      }
      if (sql.startsWith('insert into referral_commissions')) return { rows: [] }
      return { rows: [] }
    })

    await accrueCommission(tx, { downlineId: 8, completionId: 'completion-10', reward: 5 })

    expect(mocks.commissionUnitsForReward).toHaveBeenCalledWith(5, false)
  })
})
