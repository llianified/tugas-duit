# tugas-duit

Telegram Mini App: user mengerjakan captcha → dapat credit → bisa ditarik jadi Rupiah.
**Produksi, uang nyata, Postgres nyata (Railway).** Bug di alur ekonomi = kerugian finansial.

## Peta direktori

| Path | Isi |
| --- | --- |
| `app/` | Route Next.js (App Router). `app/api/*` handler, `app/admin/*` panel admin. |
| `domain/` | Aturan ekonomi murni, tanpa I/O: `economy`, `economy-config`, `energy`, `stars`. |
| `server/` | Akses DB & logika server. `ledger`, `payout`, `quota`, `challenge`, `session`, `fraud`. |
| `features/` | UI per fitur: `captcha`, `home`, `history`, `stats`, `referral`, `withdraw`, `leaderboard`. |
| `shared/` | `components/` (dipakai lintas fitur) + `lib/` (`format`, `utils`, hooks kecil). |
| `shell/` | Kerangka aplikasi: shell, router view, tema, toast, hook sesi/task. |
| `navigation/` | Definisi `AppView` + nav pill. |
| `db/migrations/` | Migrasi SQL berurutan. **Historis — jangan diedit, hanya tambah baru.** |
| `scripts/` | CLI operasional (migrate, cleanup, grant-admin, ban-user). |
| `docs/` | `keputusan-desain.md` — hal yang tampak seperti bug tapi disengaja. Baca sebelum "memperbaiki" sesuatu yang terlihat janggal. |

Alias impor: `@/*` → root repo.

## Perintah

```
pnpm dev            pnpm build          pnpm start
pnpm lint           pnpm test           pnpm test:watch
pnpm db:migrate     pnpm db:cleanup
```

Sebelum menyatakan selesai: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Database

Produksi pakai **Railway PostgreSQL** — sudah terdeploy, sudah ada datanya. Lihat `.env.example`
untuk daftar lengkap env var.

- **Jangan pernah menyarankan instal Postgres/Docker/DB lain.** Kalau perlu `DATABASE_URL` untuk
  kerja dengan data/skema asli, langsung minta connection string Railway ke user (tab
  "Variables" di service Postgres-nya) — jangan tawarkan alternatif.
- Tanpa `DATABASE_URL` di env, `server/db.ts` otomatis jatuh ke PGlite in-process
  (`server/preview-db.ts`) untuk dev — ini sudah berjalan tanpa setup apa pun, bukan sesuatu
  yang perlu "diinstal" atau "disiapkan".

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
6. Batas hari memakai zona WIB dan harus sama persis dengan
   `(now() at time zone 'Asia/Jakarta')::date` di SQL.
7. Bahasa UI dan pesan commit: Indonesia. Kode tanpa titik koma, kutip tunggal.
8. **Tanpa komentar di kode** — repo ini sengaja dibersihkan dari komentar.
9. Jangan audit/refactor skala-repo kecuali diminta eksplisit.

## Catatan yang menghemat waktu

- `shadcn` (devDependency) **dipakai**, lewat `@import 'shadcn/tailwind.css'` di
  `app/globals.css` — bukan dead code meski tak pernah diimpor dari `.ts`.
- Ikon: SVG Tabler yang disalin manual ke `shared/components/glyph.tsx`. Tidak pakai `lucide`.
- `next-env.d.ts` dan `*.tsbuildinfo` di-generate ulang, sudah di-gitignore.
- Preview lokal tanpa Postgres memakai PGlite (`server/preview-db.ts`).
