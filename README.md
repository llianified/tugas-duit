# tugas-duit

Telegram Mini App untuk mengerjakan soal singkat, mengumpulkan credit, dan menariknya menjadi Rupiah. Produksi berjalan di AWS EC2 pada [littleoni.fun](https://littleoni.fun), dengan Neon PostgreSQL, Nginx, dan service systemd `tugas-duit`.

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
- zone ID Monetag, dipakai dua format sekaligus: `show_<zone>()` polos untuk tiket rewarded dan `show_<zone>({ type: 'inApp' })` untuk interstitial otomatis.

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

Sebelum mengirim perubahan backend, jalankan:

```sh
pnpm exec tsc --noEmit --incremental false
pnpm test
```

Perubahan UI tidak perlu dicek lokal; CI menjalankan seluruh suite di tiap PR.

## Database dan deployment

Produksi menjalankan Next.js production server di AWS EC2, diproksikan Nginx pada `https://littleoni.fun`, dan dikelola oleh service systemd `tugas-duit`. Runtime memakai endpoint Neon pooled, sedangkan migrasi harus memakai `DATABASE_URL_UNPOOLED` karena advisory lock PostgreSQL bersifat per sesi dan tidak aman melalui transaction pooler.

Deployment dijalankan di EC2: pasang dependency, jalankan `pnpm db:migrate`, buat build dengan `pnpm build`, lalu restart `tugas-duit`. Pastikan `/api/health` mengembalikan HTTP 200 sebelum menganggap deployment selesai. `deploy-build` tetap ada untuk kompatibilitas rollout lama, tetapi bukan perintah deploy EC2 atau service redirect Render. Buat migrasi yang kompatibel dengan kode lama; perubahan destruktif seperti drop atau rename kolom harus dipisah ke deployment berikutnya.

Webhook Telegram produksi adalah `https://littleoni.fun/api/telegram/webhook`. Maintenance dijalankan melalui `https://littleoni.fun/api/cron/maintenance`, dilindungi `CRON_SECRET`, dan dijadwalkan oleh `.github/workflows/maintenance.yml`.

Render bukan server produksi. Service Render lama hanya menjalankan `redirect-server.js` sebagai pengalihan sementara dari domain Render lama ke `https://littleoni.fun`; konfigurasi `render.yaml` tidak boleh menjalankan aplikasi utama, migrasi, atau maintenance.

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
- `CLAUDE.md` — peta repo, aturan keras, serta panduan kerja pemilik repo dan agent.
