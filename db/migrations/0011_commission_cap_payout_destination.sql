-- Dua batas yang selama ini tidak ada, dan yang saling mengunci.
--
-- Keduanya digabung dalam satu migrasi karena memperbaiki salah satunya saja
-- tidak menutup apa pun: komisi tanpa plafon adalah mesin pencetak saldo, dan
-- tujuan pembayaran tanpa batas adalah jalan keluarnya. Menutup satu ujung hanya
-- memindahkan kemacetan, bukan menghentikan aliran.

-- 1. Plafon komisi referral harian.
--
-- `credits_earned` di tabel ini menampung reward task, dan plafonnya sengaja
-- **tidak** dipakai bersama: komisi memang dirancang berada di luar plafon task
-- (lihat `getDailyCreditCap` di `domain/economy.ts`), karena ia sudah didanai dari
-- task downline yang masing-masing dibatasi. Argumen itu benar untuk *rasio*-nya
-- dan tetap dipertahankan — yang tidak dibatasinya adalah *agregat*: jumlah
-- downline tidak punya batas atas di mana pun, jadi satu akun bisa menerima
-- penghasilan harian yang tidak dibatasi angka apa pun di dalam kode.
--
-- Kolom terpisah, bukan menumpang `credits_earned`, supaya kedua plafon tetap dua
-- keputusan yang berbeda dan bisa disetel sendiri-sendiri.
alter table daily_quotas
  add column commission_credits integer not null default 0,
  add constraint daily_quotas_commission_non_negative check (commission_credits >= 0);

-- 2. Index tujuan pembayaran.
--
-- `createPayout` kini menolak pengajuan ke tujuan yang sudah terikat user lain,
-- dan tanpa index pemeriksaan itu adalah seq scan atas seluruh riwayat penarikan
-- pada setiap pengajuan. Bukan unique: baris lama dari sebelum aturan ini ada
-- boleh tetap berdampingan, dan antrean admin justru perlu bisa melihatnya
-- (`listPendingPayouts` menghitung berapa akun lain memakai tujuan yang sama).
create index withdrawals_destination_idx on withdrawals(channel_id, account_number);
