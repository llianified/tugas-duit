import { rm } from 'node:fs/promises'
import { PREVIEW_TEST_DATA_DIR } from '../server/platform/preview-db.ts'

/** Menghapus database uji sekali sebelum suite jalan, supaya tiap `pnpm test` berangkat dari
 * keadaan yang sama.
 *
 * Tanpa ini direktori PGlite uji hidup terus di `os.tmpdir()` dan menumpuk baris dari SETIAP
 * jalannya. Konsekuensinya tidak terlihat di awal dan brutal belakangan: di mesin yang sudah
 * menjalankan suite ini berkali-kali, tabel `users` sempat berisi 7.478 baris dan
 * `task_completions` 15.071 — dan uji siaran, yang memang menyapu seluruh user, lewat dari batas
 * 5 detik lalu gagal sebagai timeout. Kegagalannya terbaca seperti bug pada kode siaran, padahal
 * murni sisa jalan sebelumnya, dan ia TIDAK pernah muncul di CI karena runner-nya selalu baru.
 * Itu bentuk kegagalan yang paling mahal: hanya menimpa orang yang mengembangkan, dan tidak bisa
 * dibuktikan lewat CI.
 *
 * Harganya migrasi diulang tiap jalan. Itu ongkos yang memang sudah dibayar CI di setiap run,
 * dan jauh lebih murah daripada suite yang hasilnya bergantung pada berapa kali ia pernah
 * dijalankan di mesin itu. */
export default async function resetPreviewDb(): Promise<void> {
  await rm(PREVIEW_TEST_DATA_DIR, { recursive: true, force: true })
}
