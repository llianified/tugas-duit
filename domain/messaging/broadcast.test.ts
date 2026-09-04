import { describe, expect, it } from 'vitest'
import { BROADCAST_BODY_MAX, BROADCAST_SEGMENTS, isBroadcastSegment } from './broadcast'

describe('broadcast', () => {
  it('menerima hanya segmen yang terdaftar', () => {
    for (const segment of BROADCAST_SEGMENTS) expect(isBroadcastSegment(segment.id)).toBe(true)
    expect(isBroadcastSegment('admin')).toBe(false)
    expect(isBroadcastSegment(null)).toBe(false)
  })

  it('menjaga id segmen unik dan batas pesan positif', () => {
    const ids = BROADCAST_SEGMENTS.map((segment) => segment.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(BROADCAST_BODY_MAX).toBeGreaterThan(0)
  })
})
