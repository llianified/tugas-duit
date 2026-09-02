import { describe, expect, it } from 'vitest'
import { matchesSecret } from './secret'

describe('matchesSecret', () => {
  it('menerima rahasia identik dan menolak nilai berbeda tanpa peduli panjangnya', () => {
    expect(matchesSecret('rahasia-panjang', 'rahasia-panjang')).toBe(true)
    expect(matchesSecret('rahasia-panjang', 'beda')).toBe(false)
    expect(matchesSecret('', 'rahasia-panjang')).toBe(false)
  })
})
