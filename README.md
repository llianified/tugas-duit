# tugas-duit

Telegram Mini App untuk mengerjakan soal singkat, mengumpulkan credit, dan menariknya menjadi Rupiah. Aplikasi ini berjalan di produksi pada Vercel dengan Neon PostgreSQL dan menangani saldo serta pembayaran nyata.

## Fitur utama

- task singkat dengan energi, stok reward, rank, dan streak;
- ledger credit, referral, leaderboard, riwayat, serta statistik;
- penarikan Rupiah dengan alur tinjau dan bukti transfer;
- premium melalui QRIS dinamis KlikQRIS;
- tiket task dan interstitial melalui Monetag;
- bonus serta gerbang keanggotaan channel Telegram;
- notifikasi bot dan pekerjaan maintenance terjadwal;
- panel admin untuk ekonomi, user, operasional, dan penarikan.

## Stack

- Next.js 16 App Router, React 19, dan TypeScript;
- Tailwind CSS 4 dan Base UI;
- Neon PostgreSQL untuk produksi;
- PGlite in-process untuk development dan test tanpa Postgres lokal;
- SWR untuk state server di klien;
- Vitest dan ESLint.

Package manager dikunci ke pnpm 10 dan runtime membutuhkan Node.js 22.9 atau lebih baru.

## Arsitektur

Arah dependensi dijaga oleh `tests/architecture.test.ts` agar domain bisnis tetap terpisah dari I/O dan UI.

| Direktori | Tanggung jawab |
| --- | --- |
| `app/` | Page dan Route Handler Next.js, termasuk panel admin. |
| `domain/` | Aturan serta tipe bisnis murni tanpa I/O. |
| `server/` | Orkestrasi server, transaksi, ledger, payout, sesi, dan integrasi. |
| `features/` | UI dan perilaku per fitur. |
| `shared/` | Komponen dan utilitas lintas fitur. |
| `shell/` | Kerangka Mini App, sesi klien, routing view, dan integrasi Telegram. |
| `navigation/` | Definisi view dan navigasi utama. |
| `db/migrations/` | Migrasi SQL berurutan; file lama tidak boleh diedit. |
| `scripts/` | CLI migrasi dan operasional. |
| `docs/` | Keputusan desain dan ADR yang menjelaskan trade-off penting. |

Alias impor `@/*` mengarah ke root repo. Aturan lengkap kontribusi dan batas arsitektur berada di `CLAUDE.md`.

## Menjalankan lokal

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Buka URL yang ditampilkan Next.js. Tanpa `DATABASE_URL`, aplikasi otomatis memakai PGlite dan menyediakan login preview; tidak perlu memasang PostgreSQL atau Docker.

Salin nilai yang dibutuhkan dari `.env.example` ke `.env.development.local` jika ingin menguji integrasi eksternal. Variabel minimum bergantung pada jalur yang diuji:

- `DATABASE_URL` untuk runtime Neon, menggunakan endpoint pooled;
- `DATABASE_URL_UNPOOLED` untuk migrasi, menggunakan endpoint langsung;
- kredensial Telegram untuk login, webhook, dan notifikasi bot;
- `APP_ORIGIN` serta `CRON_SECRET` untuk callback dan maintenance;
- kredensial KlikQRIS untuk premium;
- zone ID Monetag untuk interstitial otomatis in-app; rewarded/tiket memakai Giga.pub project `7799`.

Jangan commit file environment atau rahasia.

## Perintah

| Perintah | Kegunaan |
| --- | --- |
| `pnpm dev` | Menjalankan development server. |
| `pnpm build` | Membuat build produksi Next.js. |
| `pnpm start` | Menjalankan hasil build. |
| `pnpm lint` | Menjalankan ESLint. |
| `pnpm test` | Menjalankan seluruh test sekali. |
| `pnpm test:watch` | Menjalankan Vitest dalam watch mode. |
| `pnpm db:migrate` | Menjalankan migrasi SQL secara manual. |
| `pnpm db:cleanup` | Menjalankan maintenance dari CLI. |
| `pnpm db:grant-admin` | Memberi akses admin. |
| `pnpm db:ban-user` | Memblokir user. |

Sebelum mengirim perubahan, jalankan:

```sh
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm test
pnpm build
```

## Database dan deployment

Produksi memakai endpoint Neon pooled untuk runtime serverless. Migrasi harus memakai `DATABASE_URL_UNPOOLED` karena advisory lock PostgreSQL bersifat per sesi dan tidak aman melalui transaction pooler.

Script `vercel-build` menjalankan migrasi sebelum build hanya pada deployment Production. Preview deployment tidak memigrasi database produksi. Buat migrasi yang kompatibel dengan kode lama; perubahan destruktif seperti drop atau rename kolom harus dipisah ke deployment berikutnya.

Maintenance dijalankan melalui `/api/cron/maintenance`, dilindungi `CRON_SECRET`, dan dijadwalkan di `vercel.json`.

## Keamanan dan invariant uang

- token sesi disimpan sebagai hash dan cookie produksi bersifat `HttpOnly`, `Secure`, `SameSite=None`, serta `Partitioned`;
- query database memakai parameter dan data user selalu dibatasi oleh sesi;
- mutasi saldo berjalan lewat ledger dan transaksi database;
- idempotency, constraint SQL, row lock, serta advisory lock menjaga jalur payout;
- angka ekonomi berasal dari konfigurasi database dan dikelola melalui panel admin;
- CSP produksi memakai nonce dan kebijakan khusus untuk Telegram serta provider iklan.

Perubahan pada saldo, payout, referral, auth, atau monetisasi harus mempertahankan invariant di test dan migrasi terkait.

## Dokumentasi keputusan

- `docs/keputusan-desain.md` — perilaku yang tampak janggal tetapi disengaja;
- `docs/adr/0001-csp-jaringan-iklan.md` — batas CSP dan prosedur audit provider iklan;
- `docs/adr/0002-sesi-di-iframe.md` — cookie CHIPS dan fallback sesi khusus preview;
- `CLAUDE.md` — peta repo, aturan keras, serta panduan kerja untuk contributor dan agent.
