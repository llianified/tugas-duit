import { describe, expect, it } from 'vitest'
import { MONETAG_DEFAULT_ZONE_ID } from './monetag-zone'

describe('Monetag default zone', () => {
  it('tetap berupa id numerik yang aman dipakai dalam nama fungsi SDK', () => {
    expect(MONETAG_DEFAULT_ZONE_ID).toMatch(/^\d+$/)
  })
})
