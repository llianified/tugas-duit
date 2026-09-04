# tugas-duit

Telegram Mini App: user mengerjakan captcha → dapat credit → bisa ditarik jadi Rupiah.
**Produksi, uang nyata, Postgres nyata (Neon).** Bug di alur ekonomi = kerugian finansial.

## Peta direktori

| Path | Isi |
| --- | --- |
| `app/` | Route Next.js (App Router). `app/api/*` handler, `app/admin/*` panel admin. |
| `domain/` | Aturan dan tipe bisnis murni tanpa I/O: ekonomi, challenge, progression, statistik, referral, dan penarikan. |
| `server/` | Akses DB dan orkestrasi server: ledger, payout, quota, challenge, session, fraud, serta integrasi eksternal. |
| `features/` | UI per fitur: `captcha`, `home`, `history`, `stats`, `referral`, `withdraw`, `leaderboard`, `ads`. |
| `shared/` | `components/` (dipakai lintas fitur) + `lib/` (`format`, `utils`, hooks kecil). |
| `shell/` | Kerangka aplikasi gelap-saja: shell, router view, toast, hook sesi/task, serta sinkronisasi viewport dan warna chrome Telegram. |
| `navigation/` | Definisi `AppView` + nav pill. |
| `db/migrations/` | Migrasi SQL berurutan. **Historis — jangan diedit, hanya tambah baru.** |
| `scripts/` | CLI operasional (migrate, cleanup, grant-admin, ban-user). |
| `docs/` | Keputusan desain dan ADR untuk trade-off penting. Baca sebelum "memperbaiki" sesuatu yang terlihat janggal. |

Alias impor: `@/*` → root repo.

## Perintah

```
pnpm dev            pnpm build          pnpm start
pnpm lint           pnpm test           pnpm test:watch
pnpm db:migrate     pnpm db:cleanup
```

Sebelum menyatakan selesai: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Database

Produksi pakai **Neon PostgreSQL**, app-nya di **Vercel** — sudah terdeploy, sudah ada datanya.
Lihat `.env.example` untuk daftar lengkap env var.

- **Jangan pernah menyarankan instal Postgres/Docker/DB lain.** Kalau perlu `DATABASE_URL` untuk
  kerja dengan data/skema asli, langsung minta connection string Neon ke user — jangan tawarkan
  alternatif.
- Tanpa `DATABASE_URL` di env, `server/db.ts` otomatis jatuh ke PGlite in-process
  (`server/preview-db.ts`) untuk dev — ini sudah berjalan tanpa setup apa pun, bukan sesuatu
  yang perlu "diinstal" atau "disiapkan".
- **Dua connection string, dua keperluan.** Runtime memakai endpoint *pooled* (`-pooler`);
  `pnpm db:migrate` memakai endpoint *langsung* lewat `DATABASE_URL_UNPOOLED`, karena
  `pg_advisory_lock` bersifat per-sesi dan pooler Neon berjalan di mode transaksi.
- **Migrasi jalan sendiri, tapi hanya di deploy Production.** Vercel memakai script
  `vercel-build`, yang menjalankan `scripts/migrate.ts --deploy` sebelum `next build`.
  Flag `--deploy` itu penjaganya: migrasi dilewati kecuali `VERCEL_ENV=production`, karena
  build ikut jalan di tiap deploy Preview dan branch setengah jadi tidak boleh memigrasi
  database produksi. Jalur otomatis juga menolak jalan tanpa `DATABASE_URL_UNPOOLED` —
  `pg_advisory_lock` tidak menjamin apa pun di pooler mode transaksi. Migrasi gagal =
  build gagal, jadi kode tidak pernah live di atas skema yang belum siap.
  `pnpm db:migrate` manual tidak membawa flag itu dan tetap jalan apa adanya.
- **Migrasi jalan sebelum kode barunya live.** Selama migrasinya aditif (tambah kolom,
  tambah tabel) itu aman. Migrasi yang merusak — drop/rename kolom yang masih dibaca kode
  lama — akan mematahkan deploy yang sedang berjalan di jendela itu, jadi pecah dua:
  tambah dulu, hapus di deploy berikutnya. Rollback deploy juga tidak me-rollback DB.
- **Pekerjaan terjadwal lewat HTTP**, bukan proses terpisah: `app/api/cron/maintenance`,
  dijaga `CRON_SECRET`, isinya `server/maintenance.ts`. `pnpm db:cleanup` menjalankan hal yang
  persis sama dari CLI. Jadwalnya di `vercel.json` dan harus jatuh di dalam jam kirim
  notifikasi (08:00–20:00 WIB, `server/engagement.ts`) — di luar itu pesan bot tidak terkirim
  sama sekali.

## Aturan keras

1. **Setiap perubahan wajib dikonfirmasi pemilik repo dulu**, beserta alasan dan efeknya.
   Perubahan di luar rencana yang sudah disetujui ditanyakan terpisah, bukan diselipkan.
2. **Jangan ubah angka ekonomi di kode.** Semua besaran datang dari `domain/economy-config.ts`,
   dipasang dari DB di server dan dari payload `/api/session` di klien. Menyetel ekonomi =
   lewat panel admin, bukan deploy.
3. **Konversi credit → Rupiah hanya lewat `creditsToRupiah`.** Komponen tidak pernah
   mengalikan sendiri.
4. **Format angka/uang/waktu hanya lewat `shared/lib/format.ts`.** Jangan bikin formatter baru.
5. **Jangan sentuh** business logic, kontrak API, skema DB, auth, atau alur monetisasi kecuali
   memang itu yang diminta.
6. **Jangan ubah, pindahkan, atau refactor nav island di bagian paling atas aplikasi.** Posisi
   dan perilakunya sengaja diatur agar menyatu dengan komponen fullscreen Telegram; perubahan
   hanya boleh dilakukan jika diminta eksplisit oleh pemilik repo.
7. Batas hari memakai zona WIB dan harus sama persis dengan
   `(now() at time zone 'Asia/Jakarta')::date` di SQL.
8. Bahasa UI dan pesan commit: Indonesia. Kode tanpa titik koma, kutip tunggal.
9. **Komentar harus ringkas dan menjelaskan _kenapa_, bukan _apa_.** Pertahankan hanya
   trade-off, jebakan, keputusan penting, dan commented-out code yang masih disengaja.
   Padatkan komentar menjadi satu baris bila memungkinkan; jangan menambah prosa panjang
   yang mengulang kode di bawahnya.
10. Jangan audit/refactor skala-repo kecuali diminta eksplisit.

## Catatan yang menghemat waktu

- `shadcn` (devDependency) **dipakai**, lewat `@import 'shadcn/tailwind.css'` di
  `app/globals.css` — bukan dead code meski tak pernah diimpor dari `.ts`.
- Ikon: SVG Tabler yang disalin manual ke `shared/components/glyph.tsx`. Tidak pakai `lucide`.
- `next-env.d.ts` dan `*.tsbuildinfo` di-generate ulang, sudah di-gitignore.
- Preview lokal tanpa Postgres memakai PGlite (`server/preview-db.ts`).
