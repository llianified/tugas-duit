import type { StoreItemKey } from '@/domain/store/store'

/** Kunci idempotensi belanja, dan yang penting di berkas ini UMURNYA.
 *
 * Kuncinya dulu `useRef` di dalam `useStore`, dan `useStore` dipakai `StoreSheetBody` yang dirender
 * di dalam `Dialog.Portal`. Base UI melepas isi portal begitu lembarnya ditutup — `keepMounted`
 * bawaannya `false`, dan komponennya benar-benar `return null` — jadi menutup lembar di tengah
 * permintaan yang belum dijawab MENGHAPUS kunci yang justru sedang dibutuhkan. Pembelian yang
 * ternyata sudah lunas di server kehilangan satu-satunya penandanya, dan ketukan berikutnya
 * berangkat membawa kunci baru: saldo dipotong untuk kedua kalinya, dan ledger mencatat dua
 * `purchase` untuk barang yang sama pada menit yang sama.
 *
 * Percobaan ulang TANPA menutup lembar tidak pernah punya masalah itu — `store_purchases` mengenali
 * kunci yang sama dan menjawab `replayed`. Yang membocorkannya khusus unmount, jadi yang diperbaiki
 * umur kuncinya, bukan mekanismenya.
 *
 * Lingkupnya modul, artinya seumur tab. Itu lingkup yang benar untuk pertanyaan yang dijawabnya:
 * "apakah ketukan ini pengulangan dari ketukan saya barusan". Yang tidak ditutupnya adalah muat
 * ulang halaman — sesudah reload peta ini kosong lagi. Menutup itu menuntut `sessionStorage`, dan
 * di dalam iframe Telegram penyimpanan pihak ketiga bisa ditolak tanpa suara (lihat
 * `docs/adr/0002-sesi-di-iframe.md`), jadi ia menukar satu kegagalan diam dengan yang lain.
 *
 * Ditulis HANYA dari event handler, tidak pernah saat render. Modul ini ikut dievaluasi di server
 * waktu SSR, dan peta tingkat modul yang ditulis saat render akan dipakai bersama semua user —
 * bentuk kebocoran yang sama seperti yang diperingatkan `server/task/activity-cache.ts`. Karena
 * penulisannya cuma dari ketukan, salinan di server tidak pernah terisi. */
const pending = new Map<StoreItemKey, string>()

/** Kunci untuk satu barang: yang sedang menggantung kalau ada, kunci baru kalau belum. */
export function purchaseRequestId(item: StoreItemKey): string {
  const existing = pending.get(item)
  if (existing) return existing

  const created = crypto.randomUUID()
  pending.set(item, created)
  return created
}

/** Dipanggil hanya setelah server benar-benar menjawab pembeliannya — termasuk saat jawabannya
 * `replayed`, karena itu berarti pembayarannya sudah tercatat. Kegagalan jaringan sengaja TIDAK
 * membuang kuncinya: di situlah gunanya. */
export function clearPurchaseRequestId(item: StoreItemKey): void {
  pending.delete(item)
}

/** Hanya untuk uji. */
export function resetPurchaseRequestIds(): void {
  pending.clear()
}
