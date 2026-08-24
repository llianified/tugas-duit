import { getPayoutChannel, maskAccountNumber, PAYOUT_ETA_TEXT } from '@/features/withdraw/domain'
import { formatCredits, formatRupiah } from '@/shared/lib/format'
import { WITHDRAWAL_COOLDOWN_MS } from './payout-rules'
import {
  escapeTelegramHtml as escapeHtml,
  openAppMarkup,
  sendTelegramMessage,
  type SendMessageOptions,
} from './telegram'

const COOLDOWN_DAYS = Math.round(WITHDRAWAL_COOLDOWN_MS / 86_400_000)

async function send(telegramId: string, text: string, event: string, options: SendMessageOptions = {}) {
  try {
    await sendTelegramMessage(telegramId, text, options)
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
      '<b>Sip, permintaan tarik dana kamu masuk 👌</b>',
      '',
      `Jumlah: ${amount(notice)}`,
      `Tujuan: ${destination(notice)}`,
      `Nama: ${escapeHtml(notice.accountName)}`,
      '',
      `${PAYOUT_ETA_TEXT} Santai aja, nanti kami kabarin lagi di sini.`,
      `Oh iya, penarikan berikutnya baru kebuka ${COOLDOWN_DAYS} hari lagi.`,
    ].join('\n'),
    'requested',
    openAppMarkup('🎮 Lanjut cari credit'),
  )
}

export async function notifyWithdrawalPaid(notice: WithdrawalNotice) {
  await send(
    notice.telegramId,
    [
      '<b>Cair! Dana udah kami kirim 🎉</b>',
      '',
      `Jumlah: ${amount(notice)}`,
      `Tujuan: ${destination(notice)}`,
      '',
      'Cek saldo kamu ya. Kalau dalam 1×24 jam belum masuk, balas pesan ini aja.',
    ].join('\n'),
    'paid',
    openAppMarkup('🎮 Kumpulin lagi'),
  )
}

export async function notifyWithdrawalRejected(notice: WithdrawalNotice & { reason: string }) {
  await send(
    notice.telegramId,
    [
      '<b>Waduh, tarik dana kamu belum bisa kami proses</b>',
      '',
      `Alasannya: ${escapeHtml(notice.reason)}`,
      '',
      `Tenang, saldo ${amount(notice)} udah balik utuh ke akun kamu.`,
      '',
      `Cuma satu hal: cooldown ${COOLDOWN_DAYS} hari tetap jalan dari tanggal pengajuan tadi, jadi pengajuan berikutnya nunggu itu habis dulu. Sambil nunggu, betulin dulu datanya ya.`,
    ].join('\n'),
    'rejected',
    openAppMarkup('🎮 Balik ke app'),
  )
}

export async function notifyAdminLogin(input: { telegramId: string; ip: string; userAgent: string | null }) {
  await send(
    input.telegramId,
    [
      '<b>Ada yang login ke panel admin 🔐</b>',
      '',
      `IP: ${escapeHtml(input.ip)}`,
      `Perangkat: ${escapeHtml(input.userAgent ?? 'tidak diketahui')}`,
      '',
      'Kalau ini bukan kamu, buruan ganti ADMIN_PASSWORD dan periksa antrean payout.',
    ].join('\n'),
    'admin-login',
  )
}
