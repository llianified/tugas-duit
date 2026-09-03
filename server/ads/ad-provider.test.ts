import { describe, expect, it } from 'vitest'
import { resolveAdProvider } from './ad-provider'

describe('resolveAdProvider', () => {
  it('memakai spot OnClicka 6145580 untuk tiket rewarded', () => {
    expect(resolveAdProvider()).toEqual({ provider: 'onclicka', unitId: '6145580' })
  })
})
