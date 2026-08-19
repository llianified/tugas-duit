import { describe, expect, it } from 'vitest'
import { isDraftValid, validateWithdrawalDraft } from './domain'

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
