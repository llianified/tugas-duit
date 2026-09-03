'use client'

import { showFailureReason as adFailureReason } from '@/shell/monetag-sdk'

/** Kontrak minimum yang dibutuhkan penonton: satu fungsi yang menayangkan iklan berhadiah dan resolve saat tayangannya tuntas. Tinggal di sini, bukan di adapter SDK, supaya pergantian jaringan tidak menyeret berkas ini. */
export type AdShow = () => Promise<unknown>

/** Jeda setelah dokumen terlihat lagi sebelum tayangan dinyatakan ditinggal. Sebagian format berhadiah baru me-resolve promise-nya persis saat penonton kembali; tanpa jeda ini kepulangan yang sah ikut terbaca sebagai batal. */
const RETURN_GRACE_MS = 2_500

/** Penjaga terakhir kalau SDK mati tanpa suara: promise-nya tidak pernah selesai DAN dokumennya tidak pernah pergi, jadi tidak ada satu pun sinyal yang membebaskan tombol dari "Memuat". Panjangnya sengaja jauh di atas durasi kreatif berhadiah mana pun — ini katup darurat, bukan batas waktu menonton. */
const HANG_BACKSTOP_MS = 180_000

export type AdWatchSettled = { status: 'finished' } | { status: 'failed'; reason: string }

export type AdWatchOutcome =
  | AdWatchSettled
  /** Penonton mengetuk kreatifnya lalu menekan back: iklannya hilang dari layar tanpa promise-nya pernah selesai. `late` adalah promise yang sama yang masih berjalan — ia menolak menyerah pada tayangan yang ternyata tuntas belakangan. */
  | { status: 'abandoned'; late: Promise<AdWatchSettled> }

/** Fungsi show rewarded hanya resolve kalau tayangannya benar-benar tuntas, tapi ia juga tidak pernah reject saat penonton kabur ke halaman pengiklan — jadi tombolnya bisa menggantung di "Memuat" selamanya. Perginya dokumen lalu kembali dipakai sebagai tanda batal supaya UI selalu punya jawaban.
 *
 * Tanda itu cuma tebakan, dan tebakan yang salah di sini berarti user menonton iklan penuh lalu tidak dapat apa-apa: dokumen juga tersembunyi saat ada notifikasi masuk, layar terkunci, atau user pindah chat sebentar di tengah tayangan. Karena itu jawaban `abandoned` TIDAK menutup pintu — `play()` dibiarkan hidup di `late`, dan tayangan yang tuntas belakangan tetap berhak atas tiketnya. Yang dikorbankan hanya urutan pesannya, bukan hadiahnya. */
export function watchAdToFinish(play: AdShow): Promise<AdWatchOutcome> {
  let resolveSettled: ((value: AdWatchSettled) => void) | undefined
  const settled = new Promise<AdWatchSettled>((resolve) => {
    resolveSettled = resolve
  })

  return new Promise<AdWatchOutcome>((resolve) => {
    let decided = false
    let leftPage = false
    let graceTimer: ReturnType<typeof setTimeout> | undefined

    function stopWatching() {
      clearTimeout(graceTimer)
      clearTimeout(backstopTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('pageshow', onReturn)
    }

    function decide(outcome: AdWatchOutcome) {
      if (decided) return
      decided = true
      stopWatching()
      resolve(outcome)
    }

    function onLeave() {
      leftPage = true
      clearTimeout(graceTimer)
    }

    function onReturn() {
      if (!leftPage || decided) return
      clearTimeout(graceTimer)
      graceTimer = setTimeout(() => decide({ status: 'abandoned', late: settled }), RETURN_GRACE_MS)
    }

    /** `pagehide`/`pageshow` untuk WebView yang menahan halaman di bfcache saat kreatifnya dibuka, `visibilitychange` untuk yang cuma menyembunyikannya. Dua-duanya dipasang karena WebView Telegram tidak konsisten mengirim keduanya. */
    function onVisibilityChange() {
      if (document.hidden) onLeave()
      else onReturn()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('pageshow', onReturn)
    /** Dipasang setelah listener-nya supaya `stopWatching` tidak pernah menyentuhnya sebelum ia ada: satu-satunya jalan ke sana adalah `decide`, dan `decide` baru mungkin terpanggil dari timer atau event setelah baris ini lewat. */
    const backstopTimer = setTimeout(
      () => decide({ status: 'abandoned', late: settled }),
      HANG_BACKSTOP_MS,
    )

    /** Hasil asli `play()` selalu diumumkan ke `late` lebih dulu, baru dipakai menjawab. Urutannya penting: kalau `abandoned` sudah terlanjur dijawab, `decide` di sini tidak melakukan apa-apa dan `late` yang membawa hasilnya ke pemanggil. */
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
