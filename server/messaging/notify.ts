import { getPayoutChannel, maskAccountNumber, PAYOUT_ETA_TEXT } from '@/domain/economy/withdrawal'
import { formatCredits, formatRupiah, formatShortDate } from '@/shared/lib/format'
import {
  escapeTelegramHtml as escapeHtml,
  openAppMarkup,
  sendTelegramMessage,
  sendTelegramPhoto,
  type SendMessageOptions,
  type TelegramPhotoInput,
} from '../integrations/telegram'

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
  /** Datang dari pemanggil, bukan dari konstanta modul: jedanya 3 hari untuk user premium dan 7 untuk yang lain, dan hanya `server/payout.ts` yang tahu status premium orangnya. */
  cooldownDays: number
}

const destination = (notice: WithdrawalNotice) =>
  `${getPayoutChannel(notice.channelId).name} · ${maskAccountNumber(notice.accountNumber)}`

const amount = (notice: WithdrawalNotice) =>
  `${formatCredits(notice.credits)} TD (${formatRupiah(notice.amountIdr)})`

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
      `Oh iya, penarikan berikutnya baru kebuka ${formatCredits(notice.cooldownDays)} hari lagi.`,
    ].join('\n'),
    'requested',
    openAppMarkup('🎮 Lanjut cari TD'),
  )
}

export async function notifyWithdrawalPaid(
  notice: WithdrawalNotice,
  proof?: TelegramPhotoInput,
): Promise<string | null> {
  const text = [
    '<b>Cair! Dana udah kami kirim 🎉</b>',
    '',
    `Jumlah: ${amount(notice)}`,
    `Tujuan: ${destination(notice)}`,
    '',
    proof
      ? 'Bukti transfernya kami lampirin di atas. Kalau belum masuk juga, balas pesan ini aja.'
      : 'Cek saldo kamu ya. Kalau belum masuk juga, balas pesan ini aja.',
  ].join('\n')
  const markup = openAppMarkup('🎮 Kumpulin lagi')

  if (proof) {
    try {
      return await sendTelegramPhoto(notice.telegramId, proof, text, markup)
    } catch (error) {
      console.error(`[notify] bukti transfer gagal dikirim ke ${notice.telegramId}:`, error)
    }
  }

  await send(notice.telegramId, text, 'paid', markup)
  return null
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
      `Cuma satu hal: jeda ${formatCredits(notice.cooldownDays)} hari tetap jalan dari tanggal pengajuan tadi, jadi pengajuan berikutnya nunggu itu habis dulu. Sambil nunggu, betulin dulu datanya ya.`,
    ].join('\n'),
    'rejected',
    openAppMarkup('🎮 Balik ke app'),
  )
}

export async function notifyPremiumActivated(
  telegramId: string,
  months: number,
  premiumUntil: number,
) {
  await send(
    telegramId,
    [
      '<b>Premium kamu aktif 👑</b>',
      '',
      `Paket ${formatCredits(months)} bulan udah nyala. Berlaku sampai ${formatShortDate(premiumUntil)}.`,
      '',
      'Energi kamu sekarang lebih besar dan ngisi lebih cepat, stok reward muat lebih banyak, iklan yang nongol sendiri hilang, dan penarikan bisa lebih sering.',
    ].join('\n'),
    'premium-activated',
    openAppMarkup('👑 Buka app'),
  )
}

/** Barang toko yang dibayar lewat QRIS. Sengaja tidak menyebut nominal: yang ditunggu user setelah
 * membayar cuma satu jawaban — barangnya sudah masuk atau belum — dan angka yang diulang di sini
 * membuat pesan konfirmasi terbaca seperti tagihan kedua. */
export async function notifyShopOrderPaid(telegramId: string, itemTitle: string) {
  await send(
    telegramId,
    [
      '<b>Pembayaran kamu masuk 🎉</b>',
      '',
      `${escapeHtml(itemTitle)} udah aktif di akun kamu.`,
      '',
      'Buka app-nya sekarang, langsung kepakai.',
    ].join('\n'),
    'shop-paid',
    openAppMarkup('🎮 Pakai sekarang'),
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

/** Ember kegagalan global tidak lagi bisa menutup pintu masuk admin (lihat komentar di
 * `app/api/admin/login/route.ts`), tapi penuhnya tetap berarti ada yang sedang menebak sandi dari
 * banyak IP sekaligus. Tanpa pesan ini kejadiannya hanya tertulis di log yang tidak dibaca siapa
 * pun saat sedang berlangsung. */
export async function notifyAdminLoginFlood(input: {
  telegramId: string
  failures: number
  ip: string
  userAgent: string | null
}) {
  await send(
    input.telegramId,
    [
      '<b>Banjir percobaan login admin ⚠️</b>',
      '',
      `Lebih dari ${input.failures} sandi salah dalam satu jam terakhir.`,
      `IP terakhir: ${escapeHtml(input.ip)}`,
      `Perangkat: ${escapeHtml(input.userAgent ?? 'tidak diketahui')}`,
      '',
      'Sandi yang benar tetap bisa masuk. Kalau ini berlanjut, ganti ADMIN_PASSWORD.',
    ].join('\n'),
    'admin-login-flood',
  )
}

/** Hak admin yang berpindah adalah aksi paling sensitif di panel, dan satu-satunya yang efeknya bertahan setelah penyerangnya hilang. Pemilik dikabari langsung, bukan cuma dicatat di `admin_actions` — jejak audit menjawab pertanyaan sesudah insiden, pesan ini yang memberi kesempatan menghentikannya saat masih berlangsung. */
export async function notifyAdminRightsChanged(input: {
  telegramId: string
  granted: boolean
  targetName: string
  byName: string
  reason: string
}) {
  await send(
    input.telegramId,
    [
      input.granted ? '<b>Hak admin diberikan 🔑</b>' : '<b>Hak admin dicabut 🔒</b>',
      '',
      `Akun: ${escapeHtml(input.targetName)}`,
      `Oleh: ${escapeHtml(input.byName)}`,
      `Alasan: ${escapeHtml(input.reason)}`,
      '',
      'Kalau ini bukan kamu, cabut haknya sekarang dan ganti ADMIN_PASSWORD.',
    ].join('\n'),
    'admin-rights',
  )
}
