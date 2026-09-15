# Kesiapan peluncuran

Terakhir diaudit: 16 September 2026.

**Status: belum siap diluncurkan.** Produksi masih sehat saat diaudit (`GET /api/health` mengembalikan HTTP 200), tetapi deploy terbaru gagal dan maintenance harian tidak berjalan.

## Penghambat P0

- [ ] **Deploy `main` kembali hijau.** Run `35008676832` gagal saat `next build` dengan exit code 137 karena kehabisan memori. Konfigurasi build sudah dibatasi ke satu worker; verifikasi perbaikannya pada deploy berikutnya.
- [ ] **Isi secret `CRON_SECRET` di GitHub Actions**, samakan dengan nilai di EC2, lalu jalankan `Maintenance harian` secara manual sampai HTTP 200. Run terjadwal terakhir gagal karena secret kosong.
- [ ] **Lindungi branch `main`.** Wajibkan pull request dan status check `Quality checks`; saat audit, branch belum memiliki protection rule.

## Perbaikan cepat yang sudah diterapkan

- [x] CI berjalan pada push ke `main`, bukan branch lama `master`.
- [x] Deploy hanya berjalan setelah CI untuk `main` sukses.
- [x] Deploy memakai SHA yang benar-benar lolos CI, bukan selalu mengambil commit terbaru.
- [x] Migrasi database dijalankan sebelum build dan restart service.
- [x] Health check setelah restart mencoba ulang selama masa startup.
- [x] Build produksi dibatasi ke satu worker untuk menekan puncak penggunaan memori EC2.

## Pemeriksaan konfigurasi produksi

Jangan tulis nilainya di dokumen atau log. Cukup pastikan semuanya tersedia di tempat yang benar.

- [ ] EC2 memiliki `DATABASE_URL` pooled dan `DATABASE_URL_UNPOOLED` direct.
- [ ] EC2 memiliki `APP_ORIGIN=https://littleoni.fun`.
- [ ] Telegram memiliki `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, dan `TELEGRAM_WEBHOOK_SECRET`; webhook mengarah ke `/api/telegram/webhook` tanpa error tertunda.
- [ ] `CRON_SECRET` di EC2 sama dengan GitHub Actions.
- [ ] KlikQRIS memiliki `KLIKQRIS_API_KEY` dan `KLIKQRIS_MERCHANT_ID`; callback premium mengarah ke origin produksi.
- [ ] Monetag memiliki zone ID serta postback secret yang sesuai dengan dashboard provider.
- [x] CSP enforcing, HSTS, `nosniff`, referrer policy, dan permissions policy muncul pada respons produksi.

## Smoke test sebelum membuka trafik

Gunakan akun Telegram milik sendiri dan jangan memindahkan uang nyata hanya untuk pengujian.

- [ ] Login dari Telegram Mini App dan muat sesi tanpa loop atau layar kosong.
- [ ] Selesaikan satu task, pastikan credit masuk tepat sekali, lalu cek riwayat dan statistik.
- [ ] Uji tiket iklan sampai postback menerbitkan task tepat sekali.
- [ ] Buka checkout premium dan pastikan nominal serta callback benar tanpa menyelesaikan pembayaran yang tidak diperlukan.
- [ ] Buat lalu batalkan atau tolak penarikan uji tanpa transfer nyata; pastikan saldo dan ledger kembali konsisten.
- [ ] Masuk ke panel admin, cek ekonomi, daftar user, operasional, dan antrean penarikan.
- [ ] Jalankan maintenance manual dan pastikan hasilnya HTTP 200.

## Operasional dan pemulihan

- [ ] Aktifkan alert untuk `/api/health`, kegagalan deploy, dan kegagalan maintenance.
- [ ] Catat commit produksi terakhir yang sehat sebelum tiap deploy.
- [ ] Pastikan backup Neon aktif dan prosedur restore pernah diuji.
- [ ] Siapkan rollback kode ke commit sehat. Migrasi database tidak ikut ter-rollback dan harus tetap kompatibel dengan kode lama.

## Definisi siap launch

Launch boleh diteruskan setelah seluruh P0 selesai, CI dan deploy `main` hijau, maintenance berhasil, serta smoke test jalur Telegram, credit, premium, dan penarikan ditandai lulus.
