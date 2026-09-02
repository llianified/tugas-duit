
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

/** Membelah angka yang SUDAH diformat menjadi tiga bagian, supaya penyaji bisa meredam bagian yang bukan inti (gaya angka besar fomo: bagian utama terang, desimal & satuan abu-abu). Sengaja bekerja pada string hasil `toLocaleString('id-ID')`, bukan pada angka: pemisah ribuan di sini titik dan desimalnya koma, jadi pembelahan gaya Inggris (`split('.')`) akan salah memotong "Rp1.234" menjadi "Rp1" + "234". - `lead`  : apa pun sebelum digit pertama (tanda minus, "Rp", "+"). - `main`  : bagian bilangan bulat beserta pemisah ribuannya. - `trail` : koma desimal beserta digit setelahnya, kosong bila bilangannya bulat. Sufiks pemadatan dari `formatCompact` ("rb"/"jt") ikut masuk `trail`: ia satuan, bukan bagian bilangan, jadi diredam bersama desimal — kalau tidak, "rb" akan tampil seterang angka pokoknya dan ikut mengklaim perhatian. */
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

  let main = decimalIndex === -1 ? rest : rest.slice(0, decimalIndex)
  let trail = decimalIndex === -1 ? '' : rest.slice(decimalIndex)

  const suffix = main.match(/\p{L}+$/u)?.[0]
  if (suffix) {
    main = main.slice(0, -suffix.length)
    trail = `${suffix}${trail}`
  }

  return { lead, main, trail }
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

/** Apakah dua cap waktu jatuh pada hari WIB yang sama. Diekspor supaya penyaji tidak menyusun definisi "hari ini" sendiri lewat `new Date().getDate()` — itu memakai zona perangkat, sementara seluruh konsep "hari" di repo ini WIB (lihat `formatHistoryTime`). */
export function isSameWibDay(timestamp: number, now: number = Date.now()): boolean {
  return wibDayKey(new Date(timestamp)) === wibDayKey(new Date(now))
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

/** Tanggal + jam lengkap, dikunci WIB dan diberi labelnya. Dipakai untuk jejak yang harus bisa dirujuk ulang oleh orang lain — audit perubahan ekonomi, misalnya — jadi zonanya disebut di teksnya. Sama seperti `formatHistoryTime`, ia sengaja tidak memakai zona perangkat: admin bisa membacanya dari mana saja, sementara seluruh konsep "hari" di repo ini WIB. */
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

/** Angka panjang dipadatkan jadi "100rb" / "1,5jt". `from` menentukan mulai angka berapa pemadatan berlaku; di bawahnya angka tampil utuh. Defaultnya 10.000 karena itu ambang yang sudah dipakai dasbor admin sejak awal — tabel rapat di sana untung dari angka pendek. Hero beranda menaikkannya ke 100.000 lewat `HERO_COMPACT_FROM`: saldo kecil lebih berguna dibaca presisi, dan di sana yang dikejar cuma mencegah angka meluber melewati tombol di sebelahnya. */
const COMPACT_TIERS = [
  { divisor: 1_000_000_000_000, suffix: 'T' },
  { divisor: 1_000_000_000, suffix: 'M' },
  { divisor: 1_000_000, suffix: 'jt' },
  { divisor: 1_000, suffix: 'rb' },
] as const

function compactDigits(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',')
}

export function formatCompact(value: number, { from = 10_000 }: { from?: number } = {}): string {
  const abs = Math.abs(value)
  if (abs < from) return formatCredits(value)

  for (let index = 0; index < COMPACT_TIERS.length; index += 1) {
    const tier = COMPACT_TIERS[index]
    if (abs < tier.divisor) continue

    /** Pembulatan bisa mendorong angka melewati tingkatnya sendiri: 999.999 dibagi seribu jadi 999,999 lalu membulat ke 1000, dan tercetak "1000rb" — empat digit, justru sepanjang angka yang mau dipendekkan. Kalau itu terjadi, naikkan satuannya supaya jadi "1jt". */
    if (Math.abs(Math.round((value / tier.divisor) * 10) / 10) >= 1_000 && index > 0) {
      const wider = COMPACT_TIERS[index - 1]
      return `${compactDigits(value / wider.divisor)}${wider.suffix}`
    }

    return `${compactDigits(value / tier.divisor)}${tier.suffix}`
  }

  return formatCredits(value)
}

/** Ambang pemadatan untuk angka di hero beranda — saldo besar dan sub-line-nya. */
export const HERO_COMPACT_FROM = 100_000

export function formatRupiahCompact(
  value: number,
  options?: { from?: number },
): string {
  const rounded = Math.round(value)
  return `${rounded < 0 ? '−' : ''}Rp${formatCompact(Math.abs(rounded), options)}`
}
