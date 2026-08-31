import { describe, expect, it } from 'vitest'
import { formatHistoryTime, formatUnitCountdown } from './format'

describe('formatUnitCountdown', () => {
  it.each([
    [0, '00m 00dtk'],
    [40, '00m 40dtk'],
    [60, '01m 00dtk'],
    [3607, '60m 07dtk'],
    [Number.NaN, '00m 00dtk'],
    [-1, '00m 00dtk'],
  ])('formats %s seconds with explicit units', (seconds, expected) => {
    expect(formatUnitCountdown(seconds)).toBe(expected)
  })
})

describe('formatHistoryTime', () => {
  const wibNoon = Date.UTC(2026, 7, 18, 5, 0)

  it('memakai jam WIB, bukan jam perangkat', () => {
    expect(formatHistoryTime(wibNoon, wibNoon)).toBe('Hari ini · 12.00')
  })

  it('menentukan "Hari ini" dari tanggal WIB, bukan tanggal lokal', () => {
    const wibJustAfterMidnight = Date.UTC(2026, 7, 18, 17, 30)
    expect(formatHistoryTime(wibJustAfterMidnight, wibJustAfterMidnight)).toBe('Hari ini · 00.30')
  })

  it('menyebut tanggal ketika harinya berbeda menurut WIB', () => {
    const wibLateEvening = Date.UTC(2026, 7, 17, 16, 0)
    expect(formatHistoryTime(wibLateEvening, wibNoon)).toBe('17 Agu · 23.00')
  })

  it('masih hari yang sama menurut WIB walau berbeda hari menurut UTC', () => {
    const wibEarlyMorning = Date.UTC(2026, 7, 17, 22, 0)
    const wibSameDayEvening = Date.UTC(2026, 7, 18, 14, 0)
    expect(formatHistoryTime(wibEarlyMorning, wibSameDayEvening)).toBe('Hari ini · 05.00')
  })
})
