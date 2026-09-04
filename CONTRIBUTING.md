# Panduan kontribusi

Repo ini produksi dan memegang uang nyata. Baca `CLAUDE.md` lebih dulu — di
situ ada peta direktori, aturan keras, dan catatan soal database yang tidak
diulang di sini.

## Sebelum menulis kode

**Konfirmasi dulu ke pemilik repo.** Ini aturan keras #1, bukan formalitas.
Sebutkan apa yang mau diubah, kenapa, dan efeknya. Perubahan di luar rencana
yang sudah disetujui diajukan terpisah, bukan diselipkan ke PR yang sama.

## Menyiapkan lokal

```
pnpm install
pnpm dev
```

Tidak perlu Postgres. Tanpa `DATABASE_URL`, `server/platform/db.ts` otomatis
jatuh ke PGlite in-process — sudah jalan tanpa setup. Jangan pernah menyarankan
instal Postgres, Docker, atau database lain; kalau butuh data/skema asli,
minta connection string Neon ke pemilik repo.

Salin `.env.example` ke `.env.development.local` kalau perlu mengisi env var.
Berkas `.env*` sudah di-gitignore kecuali `.env.example`.

## Sebelum menyatakan selesai

Empat-empatnya harus hijau. CI menjalankan hal yang sama, jadi menjalankannya
lokal cuma mempercepat umpan balik.

```
pnpm exec tsc --noEmit
pnpm lint
pnpm test
pnpm build
```

`pnpm test` termasuk `tests/architecture.test.ts`, yang menegakkan batas layer.
Kalau ia gagal, jangan longgarkan tesnya — perbaiki impornya, atau ajukan
perubahan aturannya secara terpisah dengan alasannya.

## Gaya kode

Sisanya ada di `CLAUDE.md`; yang paling sering kena:

- Tanpa titik koma, kutip tunggal.
- Bahasa UI dan pesan commit: Indonesia.
- Komentar menjelaskan **kenapa**, bukan **apa**. Padatkan ke satu baris bila
  bisa. Jangan menambah prosa yang mengulang kode di bawahnya.
- Angka ekonomi tidak pernah di-hardcode — semuanya dari
  `domain/economy/economy-config.ts`, disetel lewat panel admin.
- Konversi credit → Rupiah hanya lewat `creditsToRupiah`.
- Format angka/uang/waktu hanya lewat `shared/lib/format.ts`.

## Batas layer

Arah dependensi ditegakkan `tests/architecture.test.ts` dan
`eslint.config.mjs`, bukan kesepakatan lisan:

```
domain  ←  server  ←  app
   ↑         ↑
 shared  ←  features / shell / navigation
```

- `domain/` murni, tanpa I/O. Tidak boleh mengimpor layer mana pun selain
  `domain/`.
- `server/` boleh memakai `domain/` dan utilitas `shared/` yang netral.
- `features/`, `shell/`, `navigation/` tidak boleh mengimpor `server/` atau
  `app/`.
- Impor lintas-feature **hanya** lewat barrel: `@/features/<nama>`, tidak
  pernah menyelam ke `@/features/<nama>/components/...`.
- Kode produksi tidak boleh mengimpor `__fixtures__/`.

## Migrasi database

- Migrasi itu **historis — jangan pernah diedit atau dinomori ulang**, hanya
  tambah berkas baru. Detailnya di `db/migrations/README.md`.
- Migrasi jalan **sebelum** kode barunya live. Yang aditif aman; yang merusak
  (drop/rename kolom yang masih dibaca kode lama) harus dipecah dua deploy:
  tambah dulu, hapus di deploy berikutnya.
- Rollback deploy **tidak** me-rollback database.

## Pesan commit

Conventional Commits, subjek bahasa Indonesia. Type yang diizinkan ada di
`commitlint.config.mjs`. CI memeriksa commit milik PR.

```
feat: tambahkan kartu bonus join channel
fix: kembalikan penghitung quota saat task tidak dibayar
db: tambah indeks dashboard admin
```

## Pull request

Isi seluruh template PR, terutama bagian **Dampak ke uang nyata** — jawab
"tidak ada" kalau memang tidak ada, jangan dikosongkan. Satu PR satu
perubahan; jangan campur refactor dengan perbaikan perilaku, karena reviewer
tidak akan bisa memisahkan mana yang mengubah uang.

## Melaporkan kerentanan

Jangan lewat issue publik. Lihat `SECURITY.md`.
