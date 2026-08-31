
import { creditsToRupiah, maxPayoutCredits, withdrawalMinimumCredits } from '@/domain/economy'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

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
  {
    id: 'bri',
    name: 'BRI',
    kind: 'bank',
    accountLabel: 'Nomor rekening BRI',
    accountPlaceholder: '15 digit',
    digits: { min: 15, max: 15 },
  },
  {
    id: 'mandiri',
    name: 'Mandiri',
    kind: 'bank',
    accountLabel: 'Nomor rekening Mandiri',
    accountPlaceholder: '13 digit',
    digits: { min: 13, max: 13 },
  },
]

export const DEFAULT_PAYOUT_CHANNEL_ID = PAYOUT_CHANNELS[0].id

export function getPayoutChannel(id: string): PayoutChannel {
  return PAYOUT_CHANNELS.find((channel) => channel.id === id) ?? PAYOUT_CHANNELS[0]
}

type WithdrawalState = 'processing' | 'paid' | 'rejected'

export interface WithdrawalEligibility {
  activeReferralCount: number
  requiredActiveReferrals: number
  /** Hari WIB berbeda yang pernah punya minimal satu task selesai — tidak harus berturut-turut. */
  activeDays: number
  requiredActiveDays: number
  cooldownEndsAt: number | null
  /** Jeda yang berlaku untuk user ini: premium lebih pendek, jadi tidak boleh ditulis tetap di UI. */
  cooldownDays: number
}

/** Satu penarikan yang benar-benar sudah dibayar, nama penerimanya sudah dimask di server. */
export interface PublicPayout {
  recipient: string
  channelId: string
  credits: number
  amountIdr: number
  paidAt: number
}

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
}

export const PAYOUT_ETA_TEXT = 'Dana masuk paling lama 1×24 jam kerja.'

export const WITHDRAWAL_REJECT_REASON_MAX = 280

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
  if (name.length < 3) return 'Namanya kependekan.'
  if (name.length > 100) return 'Namanya kepanjangan.'
  if (!/^[a-zA-Z .,'-]+$/.test(name)) return 'Nama hanya boleh berisi huruf dan spasi.'
  return null
}

function getAmountError(value: string, balance: number): string | null {
  const normalized = value.trim().replace(/[.\s]/g, '')
  if (normalized !== '' && !/^\d+$/.test(normalized)) {
    return 'Jumlahnya harus angka bulat, nggak boleh koma.'
  }

  const credits = parseCreditInput(value)
  if (credits < withdrawalMinimumCredits()) {
    return `Minimum penarikan ${formatCredits(withdrawalMinimumCredits())} credit (${formatRupiah(
      creditsToRupiah(withdrawalMinimumCredits()),
    )}).`
  }
  if (credits > maxPayoutCredits()) {
    return `Maksimum penarikan ${formatCredits(maxPayoutCredits())} credit per pengajuan.`
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
