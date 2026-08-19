-- Plafon penghasilan berhenti jadi jatah harian, jadi kolam yang mengisi ulang.
--
-- Sampai sekarang `daily_quotas.credits_earned` + `getDailyCreditCap` adalah penjaganya:
-- satu jatah per hari kalender WIB, penuh lagi tepat tengah malam. Yang salah dari bentuk
-- itu bukan besarnya, tapi temponya — user yang habis pukul 10.00 tidak punya alasan
-- membuka app lagi sampai besok, dan yang datang pukul 23.50 kehilangan jatah yang belum
-- terpakai. Energi sudah memakai bentuk yang benar sejak `0009_energy.sql`; migrasi ini
-- memberi plafon rupiah bentuk yang sama.
--
-- `daily_quotas` tidak dihapus: `tasks_completed` masih jaring anti-bot harian dan
-- `commission_credits` masih plafon komisi harian. `credits_earned` tetap ditulis sebagai
-- catatan (panel admin membacanya), tapi ia bukan lagi yang menahan pembayaran.
--
-- Migrasi ini **wajib** menyertai deploy kodenya, bukan menyusul: `validateEconomyConfig`
-- jalan juga saat membaca baris `economy_config`, dan baris tanpa key baru membuat
-- `loadEconomyConfig` melempar `ECONOMY_CONFIG_INVALID` untuk setiap permintaan.

alter table users
  -- Sisa kolam, bukan yang sudah dipakai: yang perlu dijawab setiap request adalah "berapa
  -- yang masih bisa dibayar", dan bentuk ini menjawabnya tanpa perlu tahu kapasitas dulu.
  add column reward_pool integer not null default 30,
  -- Jam acuan regen, sama artinya dengan `energy_updated_at`: hanya dimajukan sebanyak
  -- interval yang benar-benar dibayar, sehingga menit sisa tidak hangus.
  add column reward_pool_updated_at timestamptz not null default now(),
  -- Batas atas ditinggalkan pada `domain/reward-pool.ts` karena kapasitasnya memang berubah
  -- (rank, streak, setelan admin). Yang selalu salah, dan karena itu dijaga di sini, cuma
  -- kolam bernilai negatif.
  add constraint users_reward_pool_non_negative check (reward_pool >= 0);

-- Default 30 credit menyamai kapasitas bawaan (Rp3.000 ÷ Rp100). User yang kolamnya
-- melebihi kapasitas aktif — misalnya admin menurunkan kapasitas setelah ini —
-- dipangkas saat proyeksi, jadi tidak ada nilai tersimpan yang perlu diperbaiki di sini.

-- Setelan lama dipindahkan, bukan diganti: nilai plafon dan bonus rank yang sudah disetel
-- admin terbawa ke key barunya. `coalesce` berlapis membuat migrasi ini aman dijalankan
-- ulang, dan urutan `||` menempatkan hasil bangunan di kanan supaya ia yang menang atas
-- key lama yang sudah dikeluarkan.
update economy_config
set config = (config - 'baseDailyCapIdr' - 'rankDailyCapBonus') || jsonb_build_object(
  'rewardPoolCapIdr', coalesce(config -> 'rewardPoolCapIdr', config -> 'baseDailyCapIdr', to_jsonb(3000)),
  'rankPoolCapBonus', coalesce(config -> 'rankPoolCapBonus', config -> 'rankDailyCapBonus', to_jsonb(3)),
  -- 48 menit per credit: kapasitas bawaan 30 credit terisi penuh tepat dalam 24 jam, jadi
  -- penghasilan maksimum sehari sama dengan plafon harian yang digantikannya. Menyalakan
  -- setelan ini tidak menggeser biaya, hanya temponya.
  'rewardPoolRegenMinutes', coalesce(config -> 'rewardPoolRegenMinutes', to_jsonb(48)),
  'rewardPoolRegenCredits', coalesce(config -> 'rewardPoolRegenCredits', to_jsonb(1))
)
where id = 1;
