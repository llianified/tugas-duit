'use client'

import { showFailureReason as adFailureReason } from '@/shell/monetag-sdk'

/** Kontrak minimum yang dibutuhkan penonton: satu fungsi yang menayangkan iklan berhadiah dan resolve saat tayangannya tuntas. Tinggal di sini, bukan di adapter SDK, supaya pergantian jaringan tidak menyeret berkas ini. */
export type AdShow = () => Promise<unknown>

/** Penjaga terakhir kalau SDK mati tanpa suara. Visibility tidak dipakai sebagai bukti gagal karena Telegram WebView memang menyembunyikan dokumen selama rewarded ad; hanya Promise SDK yang boleh menyatakan tayangan selesai atau ditolak. Panjangnya sengaja jauh di atas durasi kreatif berhadiah mana pun — ini katup darurat, bukan batas waktu menonton. */
const HANG_BACKSTOP_MS = 180_000

export type AdWatchSettled = { status: 'finished' } | { status: 'failed'; reason: string }

export type AdWatchOutcome =
  | AdWatchSettled
  /** SDK tidak menjawab hingga backstop. `late` adalah Promise yang sama yang tetap menunggu konfirmasi provider agar reward yang sah tidak hilang. */
  | { status: 'abandoned'; late: Promise<AdWatchSettled> }

/** Alasan SDK dipetakan ke pesan yang berbeda supaya user tahu apa yang bisa dia lakukan — bukan supaya dia tahu apa yang rusak. Alasan mentah tidak pernah ditampilkan: formatnya berubah-ubah dan sering bukan kalimat.
 *
 * Semua cabang menutup dengan janji yang sama, "jatah kamu aman", karena itulah satu-satunya hal yang benar-benar dikhawatirkan orang saat iklan gagal. Kode teknis (`AD-NO-FILL` dan kawan-kawan) sengaja TIDAK ikut: itu sisa sesi debugging, dan bagi user pesan yang berakhir dengan kode terbaca seperti aplikasinya rusak parah. Kalau butuh melacak kegagalan, tempatnya log — bukan toast di layar orang. */
export function adFailureMessage(reason: string): string {
  const marker = reason.toLowerCase()

  if (marker.includes('no ad') || marker.includes('no fill') || marker.includes('empty')) {
    return 'Iklannya lagi kosong nih. Coba lagi beberapa menit, jatah kamu aman.'
  }

  if (
    marker.includes('closed') ||
    marker.includes('close') ||
    marker.includes('cancel') ||
    marker.includes('skip') ||
    marker.includes('abort')
  ) {
    return 'Iklannya ketutup kecepetan. Tunggu sampai nutup sendiri ya — jatah kamu aman.'
  }

  if (
    marker.includes('network') ||
    marker.includes('offline') ||
    marker.includes('fetch') ||
    marker.includes('timeout') ||
    marker.includes('connection')
  ) {
    return 'Internetnya putus pas iklan jalan. Cek koneksi, terus coba lagi — jatah kamu aman.'
  }

  if (
    marker.includes('block') ||
    marker.includes('not allowed') ||
    marker.includes('denied') ||
    marker.includes('forbidden')
  ) {
    return 'Iklannya keblokir di HP kamu. Matiin dulu pemblokir iklannya, terus coba lagi.'
  }

  return 'Iklannya gagal tayang. Coba lagi ya, jatah kamu aman.'
}

/** Promise resmi dari SDK adalah satu-satunya sumber kebenaran hasil rewarded ad. Telegram WebView dapat mengirim `visibilitychange`, `pagehide`, lalu `pageshow` saat iklan normal dibuka dan ditutup; menjadikan lifecycle halaman sebagai kegagalan membuat tayangan penuh salah dibaca sebagai batal dan mencegah task terbuka.
 *
 * Backstop hanya membebaskan UI bila SDK benar-benar tidak menjawab selama tiga menit. Promise asli tetap hidup lewat `late`, sehingga konfirmasi provider yang datang setelah backstop masih bisa mengklaim tiket. */
export function watchAdToFinish(play: AdShow): Promise<AdWatchOutcome> {
  let resolveSettled: ((value: AdWatchSettled) => void) | undefined
  const settled = new Promise<AdWatchSettled>((resolve) => {
    resolveSettled = resolve
  })

  return new Promise<AdWatchOutcome>((resolve) => {
    let decided = false

    function decide(outcome: AdWatchOutcome) {
      if (decided) return
      decided = true
      clearTimeout(backstopTimer)
      resolve(outcome)
    }

    const backstopTimer = setTimeout(
      () => decide({ status: 'abandoned', late: settled }),
      HANG_BACKSTOP_MS,
    )

    /** Hasil asli `play()` selalu diumumkan ke `late` lebih dulu. Kalau backstop sudah menjawab, `late` yang membawa konfirmasi akhirnya ke pemanggil. */
    const finish = (outcome: AdWatchSettled) => {
      resolveSettled?.(outcome)
      decide(outcome)
    }

    try {
      void play().then(
        () => finish({ status: 'finished' }),
        (error: unknown) => finish({ status: 'failed', reason: adFailureReason(error) }),
      )
    } catch (error) {
      finish({ status: 'failed', reason: adFailureReason(error) })
    }
  })
}
