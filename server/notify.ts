import { getPayoutChannel, maskAccountNumber, PAYOUT_ETA_TEXT } from '@/features/withdraw/domain'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import { sendTelegramMessage } from './telegram'

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function send(telegramId: string, text: string, event: string) {
  try {
    await sendTelegramMessage(telegramId, text)
  } catch (error) {
    console.error(`[notify] ${event} gagal dikirim ke ${telegramId}:`, error)
  }
}

interface WithdrawalNotice {
  telegramId: string
  channelId: string
  accountNumber: string
  accountName: string
  credits: number
  amountIdr: number
}

const destination = (notice: WithdrawalNotice) =>
  `${getPayoutChannel(notice.channelId).name} · ${maskAccountNumber(notice.accountNumber)}`

const amount = (notice: WithdrawalNotice) =>
  `${formatCredits(notice.credits)} credit (${formatRupiah(notice.amountIdr)})`

export async function notifyWithdrawalRequested(notice: WithdrawalNotice) {
  await send(
    notice.telegramId,
    [
      '<b>Permintaan tarik dana masuk 👌</b>',
      `Jumlah: ${amount(notice)}`,
      `Tujuan: ${destination(notice)}`,
      `Nama: ${escapeHtml(notice.accountName)}`,
      '',
      PAYOUT_ETA_TEXT,
    ].join('\n'),
    'requested',
  )
}

export async function notifyWithdrawalPaid(notice: WithdrawalNotice) {
  await send(
    notice.telegramId,
    [
      '<b>Dana udah dikirim 🎉</b>',
      `Jumlah: ${amount(notice)}`,
      `Tujuan: ${destination(notice)}`,
      '',
      'Kalau dalam 1×24 jam belum masuk, balas pesan ini ya.',
    ].join('\n'),
    'paid',
  )
}

export async function notifyWithdrawalRejected(notice: WithdrawalNotice & { reason: string }) {
  await send(
    notice.telegramId,
    [
      '<b>Tarik dana kamu ditolak</b>',
      `Alasannya: ${escapeHtml(notice.reason)}`,
      '',
      `Tenang, saldo ${amount(notice)} udah balik ke akun kamu dan bisa diajukan lagi.`,
    ].join('\n'),
    'rejected',
  )
}

export async function notifyAdminLogin(input: { telegramId: string; ip: string; userAgent: string | null }) {
  await send(
    input.telegramId,
    [
      '<b>Login panel admin</b>',
      `IP: ${escapeHtml(input.ip)}`,
      `Perangkat: ${escapeHtml(input.userAgent ?? 'tidak diketahui')}`,
      '',
      'Kalau ini bukan kamu, segera ganti ADMIN_PASSWORD dan periksa antrean payout.',
    ].join('\n'),
    'admin-login',
  )
}
