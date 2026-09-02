## Apa yang berubah

<!-- Satu paragraf. Kenapa, bukan cuma apa. -->

## Kenapa perlu

<!-- Masalah yang diselesaikan. Kalau ada issue, tautkan: Closes #123 -->

## Dampak ke uang nyata

<!-- Wajib diisi. Tulis "tidak ada" kalau memang tidak menyentuh apa pun di bawah. -->

- [ ] Menyentuh ledger, quota, kolam reward, atau komisi referral
- [ ] Menyentuh penarikan (`withdrawals`) atau pembayaran premium
- [ ] Menambah migrasi DB
- [ ] Mengubah kontrak `/api/*` yang sudah dipakai klien terdeploy

## Migrasi

<!-- Kalau menambah migrasi, jawab tiga ini. Kalau tidak, hapus bagian ini. -->

- Nomor migrasi:
- Aditif atau merusak? <!-- Merusak (drop/rename kolom yang masih dibaca kode lama) HARUS dipecah dua deploy. -->
- Aman dijalankan sebelum kode barunya live?

## Verifikasi

- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] Dicoba manual di Telegram Mini App (sebut alurnya)

## Catatan reviewer

<!-- Bagian yang paling perlu dilihat mata orang, atau trade-off yang diambil sadar. -->
