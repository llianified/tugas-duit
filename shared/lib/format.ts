
export function formatRupiah(value: number): string {
  const rounded = Math.round(value)
  return `${rounded < 0 ? '−' : ''}Rp${Math.abs(rounded).toLocaleString('id-ID')}`
}

export function formatCredits(value: number): string {
  return value.toLocaleString('id-ID')
}

export function formatCreditsDecimal(value: number): string {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export function formatCreditsPrecise(value: number): string {
  return value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

/**
 * Membelah angka yang SUDAH diformat menjadi tiga bagian, supaya penyaji bisa
 * meredam bagian yang bukan inti (gaya angka besar fomo: bagian utama terang,
 * desimal & satuan abu-abu).
 *
 * Sengaja bekerja pada string hasil `toLocaleString('id-ID')`, bukan pada angka:
 * pemisah ribuan di sini titik dan desimalnya koma, jadi pembelahan gaya Inggris
 * (`split('.')`) akan salah memotong "Rp1.234" menjadi "Rp1" + "234".
 *
 * - `lead`  : apa pun sebelum digit pertama (tanda minus, "Rp", "+").
 * - `main`  : bagian bilangan bulat beserta pemisah ribuannya.
 * - `trail` : koma desimal beserta digit setelahnya, kosong bila bilangannya bulat.
 */
export function splitAmountParts(formatted: string): {
  lead: string
  main: string
  trail: string
} {
  const firstDigit = formatted.search(/\d/)
  if (firstDigit === -1) return { lead: formatted, main: '', trail: '' }

  const lead = formatted.slice(0, firstDigit)
  const rest = formatted.slice(firstDigit)
  const decimalIndex = rest.lastIndexOf(',')

  if (decimalIndex === -1) return { lead, main: rest, trail: '' }
  return { lead, main: rest.slice(0, decimalIndex), trail: rest.slice(decimalIndex) }
}

export function formatDuration(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? ms : 0
  const roundedTenths = Math.round(safeMs / 100) / 10

  if (roundedTenths < 60) return `${formatCreditsDecimal(roundedTenths)} detik`

  const totalSeconds = Math.round(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${formatCredits(minutes)} mnt ${formatCredits(seconds)} dtk`
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.ceil(totalSeconds) : 0
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function formatUnitCountdown(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.ceil(totalSeconds) : 0
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}d`
}

export function formatLongCountdown(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0
  const minutes = Math.ceil(safe / 60)
  const hours = Math.floor(minutes / 60)

  if (hours === 0) return `${formatCredits(minutes)}m`
  return `${formatCredits(hours)}j ${formatCredits(minutes % 60)}m`
}

const TIME_ZONE = 'Asia/Jakarta'

function wibDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })
}

export function formatHistoryTime(timestamp: number, now: number = Date.now()): string {
  const date = new Date(timestamp)
  const time = date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  })

  if (wibDayKey(date) === wibDayKey(new Date(now))) return `Hari ini · ${time}`

  const day = date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: TIME_ZONE,
  })
  return `${day} · ${time}`
}

/**
 * Tanggal + jam lengkap, dikunci WIB dan diberi labelnya.
 *
 * Dipakai untuk jejak yang harus bisa dirujuk ulang oleh orang lain — audit perubahan
 * ekonomi, misalnya — jadi zonanya disebut di teksnya. Sama seperti `formatHistoryTime`,
 * ia sengaja tidak memakai zona perangkat: admin bisa membacanya dari mana saja, sementara
 * seluruh konsep "hari" di repo ini WIB.
 */
export function formatDateTime(timestamp: number): string {
  const value = new Date(timestamp).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  })
  return `${value} WIB`
}

export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  })
}

export function formatCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs < 10_000) return formatCredits(value)
  const [divisor, suffix] = abs < 1_000_000 ? [1_000, 'rb'] : [1_000_000, 'jt']
  const scaled = value / divisor
  const rounded = Math.round(scaled * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
  return `${text}${suffix}`
}
