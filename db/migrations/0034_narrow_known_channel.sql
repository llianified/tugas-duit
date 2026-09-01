-- `withdrawals_known_channel` disempitkan mengikuti `PAYOUT_CHANNELS` yang sekarang.
--
-- Migrasi `0015` mengizinkan enam tujuan (`dana`, `gopay`, `ovo`, `bca`, `bri`, `mandiri`)
-- supaya cocok dengan daftar di kode saat itu. Sejak `bri` dan `mandiri` dicabut dari
-- `features/withdraw/domain.ts`, constraint-nya jadi lebih longgar daripada kodenya. Itu
-- tidak pernah menolak apa pun — TypeScript sudah menolak lebih dulu — jadi `WD-6`, yang
-- hanya mencoba channel dari daftar kode, tidak punya cara melihat selisihnya.
--
-- Bahayanya bukan penarikan baru, melainkan pembacaan riwayat: `getPayoutChannel` dulu
-- jatuh ke channel pertama untuk id tak dikenal, sehingga baris `bri`/`mandiri` lama
-- terbaca sebagai DANA di antrean admin dan di pesan Telegram user. Sisi kode itu sudah
-- diperbaiki; migrasi ini menutup sisi database supaya selisihnya tidak tumbuh lagi.
--
-- `not valid`, dan itu bukan kelalaian — ini menyimpang dari `0012` dengan sengaja.
-- Constraint di `0012` menjaga bentuk baris yang ditulis kode kita sendiri, jadi
-- pelanggaran di sana berarti ada bug yang harus berbunyi keras. Yang di sini menjaga
-- daftar produk yang MEMANG pernah berubah, dan baris `bri`/`mandiri` yang mungkin ada
-- adalah catatan pembayaran sungguhan yang tidak boleh ditulis ulang maupun dihapus.
-- Memvalidasinya berarti mempertaruhkan kegagalan `vercel-build` — dan karena migrasi jalan
-- sebelum `next build`, itu menghentikan seluruh deploy — demi baris historis yang sudah
-- ditangani jalur pembacaannya. `not valid` tetap menolak setiap baris BARU, yang memang
-- satu-satunya hal yang masih bisa dicegah.
--
-- Kalau `select count(*) from withdrawals where channel_id not in
-- ('dana','gopay','ovo','bca')` mengembalikan nol, promosikan dengan satu perintah:
--   alter table withdrawals validate constraint withdrawals_known_channel;
alter table withdrawals drop constraint withdrawals_known_channel;
alter table withdrawals add constraint withdrawals_known_channel check (
  channel_id in ('dana', 'gopay', 'ovo', 'bca')
) not valid;
