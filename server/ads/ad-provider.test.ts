import { describe, expect, it } from 'vitest'
import { resolveAdProvider } from './ad-provider'

describe('resolveAdProvider', () => {
  it('memakai Giga.pub project 7799 untuk tiket rewarded', () => {
    expect(resolveAdProvider()).toEqual({ provider: 'gigapub', unitId: '7799' })
  })
})
