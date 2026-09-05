import {
  creditsToRupiah,
  getWithdrawalStatus,
  maxPayoutCredits,
  withdrawalMinActiveReferrals,
  withdrawalMinimumCredits,
} from '@/domain/economy/economy'

function formatCreditsForMessage(value: number): string {
  return value.toLocaleString('id-ID')
}

function formatRupiahForMessage(value: number): string {
  return `Rp${Math.round(value).toLocaleString('id-ID')}`
}

type PayoutKind = 'ewallet' | 'bank'

export interface PayoutChannel {
  id: string
  name: string
  kind: PayoutKind
  accountLabel: string
  accountPlaceholder: string
  digits: { min: number; max: number }
}

export const PAYOUT_CHANNELS: readonly PayoutChannel[] = [
  {
    id: 'dana',
    name: 'DANA',
    kind: 'ewallet',
    accountLabel: 'Nomor DANA',
    accountPlaceholder: '08xxxxxxxxxx',
    digits: { min: 10, max: 13 },
  },
  {
    id: 'gopay',
    name: 'GoPay',
    kind: 'ewallet',
    accountLabel: 'Nomor GoPay',
    accountPlaceholder: '08xxxxxxxxxx',
    digits: { min: 10, max: 13 },
  },
  {
    id: 'ovo',
    name: 'OVO',
    kind: 'ewallet',
    accountLabel: 'Nomor OVO',
    accountPlaceholder: '08xxxxxxxxxx',
    digits: { min: 10, max: 13 },
  },
  {
    id: 'bca',
    name: 'BCA',
    kind: 'bank',
    accountLabel: 'Nomor rekening BCA',
    accountPlaceholder: '10 digit',
    digits: { min: 10, max: 10 },
  },
]

export const DEFAULT_PAYOUT_CHANNEL_ID = PAYOUT_CHANNELS[0].id

/** Channel yang tidak ada di daftar dijawab dengan namanya sendiri, BUKAN dengan channel pertama. Bentuk lamanya jatuh ke `PAYOUT_CHANNELS[0]`, yaitu DANA. Constraint `withdrawals_known_channel` masih menerima `bri` dan `mandiri` dari masa ketika keduanya ditawarkan, jadi baris lama dengan channel itu akan terbaca sebagai **DANA** di dua tempat yang paling mahal salahnya: label tujuan di antrean payout — yang dibaca admin tepat sebelum mentransfer — dan pesan Telegram yang memberi tahu user ke mana uangnya dikirim. Persis mode kegagalan yang diperingatkan migrasi `0014`. Penarikan baru tidak bisa lewat sini: `createPayout` menolak channel di luar `PAYOUT_CHANNELS` sebelum validasi apa pun berjalan, dan pemilih channel hanya merender daftar itu. Jadi jalur ini murni pembacaan riwayat, dan tugasnya cuma satu — tidak berbohong. */
export function getPayoutChannel(id: string): PayoutChannel {
  const known = PAYOUT_CHANNELS.find((channel) => channel.id === id)
  if (known) return known

  const label = id.trim().toUpperCase() || 'TIDAK DIKENAL'
  return {
    id,
    name: label,
    kind: 'bank',
    accountLabel: `Nomor tujuan ${label}`,
    accountPlaceholder: '',
    digits: { min: 1, max: 32 },
  }
}

type WithdrawalState = 'processing' | 'paid' | 'rejected'

export interface WithdrawalEligibility {
  activeReferralCount: number
  requiredActiveReferrals: number
  premiumActive: boolean
  /** Apakah premium sedang diwajibkan (`withdrawalRequiresPremium`). Dikirim dari server, bukan
   * dibaca ulang di klien, supaya daftar syarat yang dilihat user selalu sama dengan yang
   * benar-benar ditegakkan `createPayout`. */
  requiresPremium: boolean
  cooldownEndsAt: number | null
  /** Jeda yang berlaku untuk user ini: premium lebih pendek, jadi tidak boleh ditulis tetap di UI. */
  cooldownDays: number
}

/** Satu penarikan yang benar-benar sudah dibayar, nama penerimanya sudah dimask di server. */
export interface Withdrawal {
  id: string
  channelId: string
  accountNumber: string
  accountName: string
  credits: number
  amountIdr: number
  requestedAt: number
  state: WithdrawalState
  paidAt: number | null
  rejectedAt: number | null
  rejectReason: string | null
  hasProof: boolean
}

export const PAYOUT_ETA_TEXT = 'Dana masuk dalam 1–7 hari kerja.'

export const WITHDRAWAL_REJECT_REASON_MAX = 280

export const PAYOUT_PROOF_MAX_BYTES = 5 * 1024 * 1024

export const PAYOUT_PROOF_ACCEPT = 'image/jpeg,image/png,image/webp'

export function sanitizeAccountNumber(value: string): string {
  return value.replace(/\D/g, '')
}

export function parseCreditInput(value: string): number {
  const normalized = value.trim().replace(/[.\s]/g, '')
  if (!/^\d+$/.test(normalized)) return 0
  const credits = Number(normalized)
  return Number.isSafeInteger(credits) ? credits : 0
}

function amountMaxDigits(): number {
  return String(maxPayoutCredits()).length
}

export function appendAmountDigit(value: string, digit: string): string {
  if (!/^\d$/.test(digit)) return value
  if (value === '' && digit === '0') return value
  if (value.length >= amountMaxDigits()) return value
  return value + digit
}

export function dropAmountDigit(value: string): string {
  return value.slice(0, -1)
}

export function getAmountPresets(balance: number): number[] {
  const all = Math.floor(balance)
  const half = Math.floor(all / 2 / 100) * 100
  const candidates = [withdrawalMinimumCredits(), half, all]

  return [...new Set(candidates)]
    .filter(
      (credits) =>
        credits >= withdrawalMinimumCredits() &&
        credits <= all &&
        credits <= maxPayoutCredits(),
    )
    .sort((a, b) => a - b)
}

export function maskAccountNumber(value: string): string {
  if (value.length <= 8) return value
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(4, value.length - 8))}${value.slice(-4)}`
}

function getAccountNumberError(channel: PayoutChannel, value: string): string | null {
  const digits = sanitizeAccountNumber(value)

  if (digits === '') return `${channel.accountLabel} belum diisi.`

  if (channel.kind === 'ewallet' && !digits.startsWith('0')) {
    return 'Nomor e-wallet mulai dari 0 ya.'
  }

  const { min, max } = channel.digits
  if (digits.length < min || digits.length > max) {
    const expected = min === max ? `${min} digit` : `${min}–${max} digit`
    return `${channel.accountLabel} harus ${expected}.`
  }

  return null
}

function getAccountNameError(value: string): string | null {
  const name = value.trim()
  if (name === '') return 'Nama pemiliknya belum diisi.'
  if (name.length < 3) return 'Namanya kependekan, minimal 3 huruf.'
  if (name.length > 100) return 'Namanya kepanjangan.'
  if (!/^[a-zA-Z .,'-]+$/.test(name)) return 'Nama cuma boleh huruf dan spasi ya.'
  return null
}

function getAmountError(value: string, balance: number): string | null {
  const normalized = value.trim().replace(/[.\s]/g, '')
  if (normalized !== '' && !/^\d+$/.test(normalized)) {
    return 'Isi angka bulat aja ya, nggak pakai koma.'
  }

  const credits = parseCreditInput(value)
  if (credits < withdrawalMinimumCredits()) {
    return `Minimum penarikan ${formatCreditsForMessage(withdrawalMinimumCredits())} TD (${formatRupiahForMessage(
      creditsToRupiah(withdrawalMinimumCredits()),
    )}).`
  }
  if (credits > maxPayoutCredits()) {
    return `Maksimum penarikan ${formatCreditsForMessage(maxPayoutCredits())} TD per pengajuan.`
  }
  if (credits > balance) return 'Jumlahnya lebih besar dari saldo kamu.'
  return null
}

export interface WithdrawalDraft {
  channelId: string
  accountNumber: string
  accountName: string
  amount: string
}

export interface WithdrawalDraftErrors {
  accountNumber: string | null
  accountName: string | null
  amount: string | null
}

export function validateWithdrawalDraft(
  draft: WithdrawalDraft,
  balance: number,
): WithdrawalDraftErrors {
  const channel = getPayoutChannel(draft.channelId)

  return {
    accountNumber: getAccountNumberError(channel, draft.accountNumber),
    accountName: getAccountNameError(draft.accountName),
    amount: getAmountError(draft.amount, balance),
  }
}

export function isDraftValid(errors: WithdrawalDraftErrors): boolean {
  return !errors.accountNumber && !errors.accountName && !errors.amount
}

export type WithdrawalGatingReason =
  | 'processing'
  | 'balance'
  | 'loading'
  | 'referrals'
  | 'premium'
  | 'cooldown'

export type WithdrawalRequirementKey = 'balance' | 'referrals' | 'premium'

export interface WithdrawalRequirement {
  key: WithdrawalRequirementKey
  done: boolean
  /** Progres dan targetnya untuk syarat yang bisa dihitung; `null` untuk syarat ya-atau-tidak.
   * Angkanya mentah — yang memformat rupiah dan credit tetap `shared/lib/format`. */
  current: number | null
  required: number | null
}

/** Syarat penarikan sampai gerbang yang sedang dihadapi user, bukan seluruh daftarnya sekaligus.
 *
 * Urutannya tetap saldo → referral → premium, dan yang belum tercapai dipotong di gerbang pertama:
 * saldo di bawah minimum hanya melihat baris saldo, referral baru muncul setelah saldonya cukup,
 * premium baru muncul setelah referralnya genap. Yang sudah lewat tetap tampil bercentang — itu
 * jejak progres, dan tanpanya daftar ini berhenti terbaca sebagai kemajuan.
 *
 * Ini membalik keputusan sebelumnya yang menampilkan ketiganya sejak layar pertama. Alasan lama
 * masih berlaku sebagian — syarat berbayar yang muncul di ujung bisa terbaca sebagai tagihan
 * mendadak — dan yang menukarnya adalah beban tiga syarat sekaligus di layar user yang saldonya
 * masih nol: satu tugas pada satu waktu jauh lebih mungkin dikerjakan daripada tiga sekaligus.
 * Karena itu premium tidak boleh mengejutkan dari tempat lain: kartu premium di beranda dan
 * daftar manfaatnya tetap menyebut jeda penarikan, jadi gerbangnya sudah pernah dibaca sebelum
 * ia menjadi baris terakhir di sini. */
export function withdrawalRequirements(input: {
  balance: number
  eligibility: WithdrawalEligibility | null
}): WithdrawalRequirement[] {
  const minimum = withdrawalMinimumCredits()
  const list: WithdrawalRequirement[] = [
    {
      key: 'balance',
      done: input.balance >= minimum,
      current: Math.floor(input.balance),
      required: minimum,
    },
  ]

  const eligibility = input.eligibility
  const referralTarget = eligibility?.requiredActiveReferrals ?? withdrawalMinActiveReferrals()
  if (referralTarget > 0) {
    list.push({
      key: 'referrals',
      done: (eligibility?.activeReferralCount ?? 0) >= referralTarget,
      current: eligibility?.activeReferralCount ?? 0,
      required: referralTarget,
    })
  }

  /** Baris premium hanya ada saat syaratnya memang menyala. Menampilkannya sebagai syarat yang
   * sudah terpenuhi saat ia tidak diwajibkan akan mengiklankan gerbang yang tidak ada. */
  if (eligibility?.requiresPremium) {
    list.push({
      key: 'premium',
      done: eligibility.premiumActive,
      current: null,
      required: null,
    })
  }

  /** Pemotongannya di sini, bukan di komponen: ia aturan urutan gerbang — sama seperti
   * `withdrawalGatingReason` — jadi ia bisa diuji tanpa merender apa pun, dan tidak ada penyaji
   * yang bisa diam-diam membocorkan gerbang berikutnya. */
  const firstPending = list.findIndex((requirement) => !requirement.done)
  return firstPending === -1 ? list : list.slice(0, firstPending + 1)
}

/** Alasan penarikan belum bisa diajukan, atau `null` kalau formulirnya boleh dibuka. Aturan, bukan penyajian, jadi ia tinggal di sini bersama `validateWithdrawalDraft` — dan bisa diuji tanpa merender apa pun.
 *
 * `processing` diperiksa PALING DULU dan itu yang memperbaiki bug-nya. Sebelumnya keadaan ini tidak punya cabang sama sekali; yang menutupinya cuma `cooldown`, karena `cooldownEndsAt` dihitung dari `max(requested_at)` sehingga pengajuan yang baru masuk otomatis menggerbang dirinya sendiri. Begitu cooldown-nya habis sementara pengajuannya MASIH `processing` — admin belum memutuskan — gerbangnya lepas, formulirnya terbuka penuh, dan `createPayout` baru menolak di langkah paling akhir dengan `WITHDRAWAL_ALREADY_PENDING`. User mengisi nominal, nomor rekening, dan nama pemilik untuk ditolak di ujung.
 *
 * Ia juga harus di atas `balance`: saldo pengajuan yang sedang diproses sudah ditahan `withdrawal_hold`, jadi saldo tersisa hampir selalu di bawah minimum dan user akan dibacakan "nabung dulu" untuk uang yang sebenarnya sedang dalam perjalanan. */
export function withdrawalGatingReason(input: {
  balance: number
  hasProcessingWithdrawal: boolean
  eligibility: WithdrawalEligibility | null
}): WithdrawalGatingReason | null {
  if (input.hasProcessingWithdrawal) return 'processing'
  if (!getWithdrawalStatus(input.balance).eligible) return 'balance'

  const eligibility = input.eligibility
  if (!eligibility) return 'loading'
  if (eligibility.activeReferralCount < eligibility.requiredActiveReferrals) return 'referrals'
  if (eligibility.requiresPremium && !eligibility.premiumActive) return 'premium'
  if (eligibility.cooldownEndsAt) return 'cooldown'
  return null
}
