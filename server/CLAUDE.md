# server/

Logika server + akses DB. Ini yang benar-benar memindahkan uang — file di sini menyentuh
`credit_ledger`, saldo user, dan status penarikan pada Postgres produksi.

- **`ledger.ts` adalah satu-satunya jalan mengubah `balance_credits`.** Semua penambahan/
  pengurangan saldo lewat `appendLedger`, dalam transaksi, dengan `idempotencyKey` — supaya
  retry (webhook Telegram terkirim dua kali, request diulang) tidak menduplikasi saldo. Jangan
  `update users set balance_credits=...` langsung dari file lain.
- **Baca baris user dengan `for update`** sebelum mengubah saldo (lihat `appendLedger`) — tanpa
  row lock, dua request bersamaan bisa balapan dan salah satu update hilang.
- `payout.ts` (penarikan), `quota.ts` (jaring anti-bot harian + plafon komisi),
  `reward-pool.ts` (kolam reward yang menahan penghasilan), `challenge.ts` (siklus soal) memakai
  aturan dari `domain/`, bukan angka sendiri — kalau perlu ubah besaran, itu tugasnya
  `domain/economy-config.ts`, bukan file di sini.
- `reward-pool.ts` membaca kapasitas dengan query terpisah dari stoknya, dan itu **disengaja**:
  baris `users` perlu `for update` saat belanja, sementara `for update` tidak boleh satu query
  dengan agregat penghitung rank. Jangan digabung jadi satu query.
- `preview-db.ts`: mode dev tanpa Postgres nyata, pakai PGlite in-process. Jangan asumsikan
  ini berperilaku identik dengan Postgres produksi untuk hal seperti constraint atau isolation
  level — untuk itu andalkan `*.test.ts` yang jalan lawan Postgres asli.
- `db/migrations/` di luar folder ini historis dan sudah pernah dijalankan di produksi —
  **jangan pernah mengedit migrasi lama**, hanya tambah file baru bernomor urut berikutnya.
