# tugas-duit

Telegram Mini App: user mengerjakan soal singkat → dapat credit → bisa ditarik jadi Rupiah.

**Produksi di Vercel** dengan **Neon PostgreSQL** — bukan proyek eksperimen.

## Stack

Next.js 16 · TypeScript · PostgreSQL

## Jalankan lokal

```sh
pnpm install
pnpm dev
```

Tanpa `DATABASE_URL`, aplikasi otomatis memakai database in-process (PGlite). Lihat
`.env.example` untuk konfigurasi lengkap.

## Validasi

```sh
pnpm exec tsc --noEmit --incremental false
pnpm lint
pnpm test
pnpm build
```

## Untuk agent

Aturan kerja, peta struktur, dan konvensi ada di `CLAUDE.md`.
