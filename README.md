# tugas-duit

Telegram Mini App: user mengerjakan captcha → dapat credit → bisa ditarik jadi Rupiah.

**Live di produksi** (Railway) — bukan proyek eksperimen.

## Stack

Next.js · TypeScript · PostgreSQL

## Jalankan lokal

```
pnpm install
pnpm dev
```

Tanpa `DATABASE_URL`, otomatis pakai database in-process (PGlite) — lihat `.env.example`.

## Untuk agent

Aturan kerja, peta struktur, dan konvensi ada di `CLAUDE.md`.
