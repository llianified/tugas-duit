import { describe, expect, it } from 'vitest'
import {
  FOUNDER_MAX_USER_ID,
  PRECISION_MIN_AVERAGE,
  PRECISION_MIN_TASKS,
  hasPrecision,
  prestigeBadges,
  taskMilestone,
} from './prestige'

describe('PRESTIGE — gengsi tanpa credit', () => {
  it('tidak memberi lencana apa pun kepada akun baru', () => {
    expect(prestigeBadges({ taskCount: 0, credits: 0, founder: false, premium: false })).toEqual([])
  })

  it('mengambil milestone tertinggi yang sudah dilewati, bukan yang pertama', () => {
    expect(taskMilestone(999)).toBeNull()
    expect(taskMilestone(1_000)?.tasks).toBe(1_000)
    expect(taskMilestone(9_999)?.tasks).toBe(5_000)
    expect(taskMilestone(12_000)?.tasks).toBe(10_000)
  })

  it('menuntut jumlah task DAN rata-rata untuk lencana Presisi', () => {
    expect(hasPrecision(PRECISION_MIN_TASKS * 9, PRECISION_MIN_TASKS)).toBe(true)
    expect(hasPrecision(PRECISION_MIN_TASKS * 9, PRECISION_MIN_TASKS - 1)).toBe(false)
    expect(
      hasPrecision((PRECISION_MIN_AVERAGE - 1) * PRECISION_MIN_TASKS, PRECISION_MIN_TASKS),
    ).toBe(false)
  })

  it('tidak membagi dengan nol saat belum ada task', () => {
    expect(hasPrecision(0, 0)).toBe(false)
  })

  it('menumpuk lencana yang memang layak, dan Perintis tidak bisa dikejar dengan task', () => {
    const veteran = prestigeBadges({
      taskCount: 5_000,
      credits: 45_000,
      founder: false,
      premium: false,
    })
    expect(veteran.map((badge) => badge.key)).toEqual(['precision', 'milestone'])

    const perintis = prestigeBadges({
      taskCount: 5_000,
      credits: 45_000,
      founder: true,
      premium: true,
    })
    expect(perintis.map((badge) => badge.key)).toEqual([
      'precision',
      'milestone',
      'premium',
      'founder',
    ])
    expect(perintis.at(-1)?.key).toBe('founder')
    expect(FOUNDER_MAX_USER_ID).toBeGreaterThan(0)
  })
})
