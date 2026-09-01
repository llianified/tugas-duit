import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatHistoryTime,
  formatUnitCountdown,
  splitAmountParts,
} from './format'

describe('splitAmountParts', () => {
  it('tidak menganggap pemisah ribuan Indonesia sebagai desimal', () => {
    expect(splitAmountParts('Rp1.234')).toEqual({ lead: 'Rp', main: '1.234', trail: '' })
  })

  it('memisahkan desimal koma dari bagian utamanya', () => {
    expect(splitAmountParts('Rp1.234,56')).toEqual({ lead: 'Rp', main: '1.234', trail: ',56' })
  })

  it('mempertahankan tanda di depan angka', () => {
    expect(splitAmountParts('−Rp2.500')).toEqual({ lead: '−Rp', main: '2.500', trail: '' })
    expect(splitAmountParts('+120')).toEqual({ lead: '+', main: '120', trail: '' })
  })

  it('tidak memaksa desimal pada bilangan bulat', () => {
    expect(splitAmountParts('0')).toEqual({ lead: '', main: '0', trail: '' })
  })

  it('aman untuk teks tanpa digit', () => {
    expect(splitAmountParts('—')).toEqual({ lead: '—', main: '', trail: '' })
  })
})

describe('formatUnitCountdown', () => {
  it.each([
    [0, '00m 00d'],
    [40, '00m 40d'],
    [60, '01m 00d'],
    [3607, '60m 07d'],
    [Number.NaN, '00m 00d'],
    [-1, '00m 00d'],
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

describe('formatDateTime', () => {
  /**
   * Dipakai jejak audit panel ekonomi, yang dibaca admin dari zona mana pun. Sama seperti
   * `formatHistoryTime`, ia mengunci WIB alih-alih mengikuti perangkat — dan menyebutkannya,
   * karena satu-satunya gunanya adalah bisa dirujuk ulang oleh orang lain.
   */
  it('memakai jam WIB dan menyebut zonanya', () => {
    expect(formatDateTime(Date.UTC(2026, 7, 18, 5, 0))).toBe('18 Agu 2026, 12.00 WIB')
  })

  it('tidak menggeser tanggal saat UTC dan WIB berbeda hari', () => {
    expect(formatDateTime(Date.UTC(2026, 7, 17, 20, 30))).toBe('18 Agu 2026, 03.30 WIB')
  })
})
