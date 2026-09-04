-- `rate_limits` adalah tabel yang paling sering ditulis di seluruh basis data, dan hampir
-- seluruh write-nya adalah `update` pada baris yang sudah ada (`count = count + n`).
-- Postgres tidak menimpa baris: tiap update menulis versi baru, dan versi lamanya jadi dead
-- tuple yang harus disapu autovacuum. Di Neon itu berarti WAL, dan WAL berarti compute
-- tetap terjaga bangun.
--
-- `count` dan `window_start` tidak dipakai indeks mana pun yang nilainya berubah, jadi
-- update-nya HOT-eligible — versi barunya bisa tinggal di halaman yang sama dan dibersihkan
-- tanpa menyentuh indeks sama sekali. Yang menghalangi hanyalah halaman yang sudah padat,
-- karena default `fillfactor` 100 tidak menyisakan ruang untuk versi baru. Beri ruang 30%,
-- lalu turunkan ambang autovacuum khusus tabel ini supaya sisa dead tuple tidak menunggu
-- 20% dari tabel yang berputar cepat.
--
-- Aditif: hanya reloptions, tanpa perubahan bentuk data, tanpa rewrite, tanpa `vacuum full`.
-- `rate_limits_window_idx` sengaja dipertahankan — `delete` retensi di
-- `server/ops/maintenance.ts` memakainya.
alter table rate_limits set (
  fillfactor = 70,
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.1
);
