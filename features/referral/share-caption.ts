import { creditsToRupiah } from '@/domain/economy/economy'
import { formatCredits, formatRupiah } from '@/shared/lib/format'

export interface ShareStats {
  /** Total credit yang pernah masuk dari task sendiri — bukan saldo sekarang. */
  earnedCredits: number
  /** Berapa teman yang sudah gabung lewat kode ini. */
  friends: number
}

/** Kalimat yang ikut terkirim bersama tautannya. Isinya angka milik user, bukan slogan. Tautan telanjang hampir tidak pernah diposting siapa pun; yang diposting adalah angka yang bisa dipamerkan, dan tautannya ikut karena kebetulan menempel. Karena itu bentuk kalimatnya berubah mengikuti apa yang sudah dipunyai user: yang belum menghasilkan apa-apa tidak diberi kalimat yang mengklaim penghasilan — kalimat yang tidak dia percayai sendiri tidak akan dia kirim. */
export function buildShareCaption(stats: ShareStats): string {
  const rupiah = formatRupiah(creditsToRupiah(stats.earnedCredits))

  if (stats.earnedCredits > 0) {
    return [
      `Gue udah ngumpulin ${rupiah} dari Tugas Duit — cuma modal jawab soal di Telegram.`,
      'Gabung pakai tautan gue, kita dua-duanya dapet bonus 👇',
    ].join(' ')
  }

  if (stats.friends > 0) {
    return [
      `${formatCredits(stats.friends)} teman gue udah gabung Tugas Duit.`,
      'Jawab soal, kumpulin credit, tarik jadi Rupiah. Ikut lewat tautan gue 👇',
    ].join(' ')
  }

  return [
    'Tugas Duit: jawab soal singkat di Telegram, kumpulin credit, tarik jadi Rupiah.',
    'Gabung pakai tautan gue, kita dua-duanya dapet bonus 👇',
  ].join(' ')
}
