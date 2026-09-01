-- Panel admin mengambil alih sisa saklar yang masih hidup sebagai konstanta kode,
-- ditambah dua tabel jejak untuk aksi yang tidak lewat `credit_ledger`.
--
-- Migrasi ini **wajib** menyertai deploy kodenya, bukan menyusul: `validateEconomyConfig`
-- jalan juga saat MEMBACA baris `economy_config`, jadi baris tanpa key baru membuat
-- `loadEconomyConfig` melempar `ECONOMY_CONFIG_INVALID` untuk setiap permintaan.

-- 1. Jejak aksi admin yang tidak meninggalkan baris ledger.
--
-- Koreksi saldo sudah punya jejaknya sendiri — `credit_ledger` append-only, lengkap dengan
-- nama admin di `note`. Yang belum punya apa pun justru aksi yang sekarang ditambahkan:
-- memberi premium, mengisi energi, mengisi stok reward, membuka bisu notifikasi. Semuanya
-- mengubah keadaan akun orang tanpa menyentuh saldo, jadi tanpa tabel ini tidak ada cara
-- menjawab "siapa yang memberi akun ini premium tiga bulan, kapan, dan atas dasar apa".
--
-- `on delete set null` untuk adminnya, `cascade` untuk targetnya: riwayat tindakan harus
-- bertahan melampaui akun admin yang melakukannya — alasan yang sama dengan
-- `economy_config_audit` di migrasi 0016 — sementara baris milik user yang benar-benar
-- dihapus memang ikut hilang bersamanya.
create table admin_actions (
  id bigint generated always as identity primary key,
  admin_id bigint references users(id) on delete set null,
  target_user_id bigint not null references users(id) on delete cascade,
  action text not null,
  -- Bentuk perubahannya, bebas per aksi: bulan premium, jumlah energi, nilai sebelum
  -- dan sesudah. Disimpan sebagai jsonb karena tiap aksi menjawab pertanyaan berbeda.
  detail jsonb,
  -- Wajib diisi pemanggilnya. Aksi admin tanpa alasan adalah baris audit yang tidak
  -- menjelaskan apa pun saat dibaca enam bulan lagi.
  reason text not null,
  created_at timestamptz not null default now(),
  constraint admin_actions_reason_present check (length(btrim(reason)) > 0)
);
create index admin_actions_target_idx on admin_actions(target_user_id, created_at desc);
create index admin_actions_created_idx on admin_actions(created_at desc);

-- 2. Pesan siaran dari panel.
--
-- Barisnya dibuat SEBELUM satu pesan pun berangkat, dan itu yang membuat pengiriman bisa
-- dilanjutkan: `bot_notifications` (migrasi 0026) menyimpan penanda per user dengan
-- `dedupe_key` berisi id siaran ini, jadi menekan "Kirim" dua kali tidak pernah mengirim
-- dua kali ke orang yang sama, dan pengiriman yang terpotong batas waktu route bisa
-- disambung tanpa mengulang dari nol.
--
-- Yang TIDAK disimpan di sini adalah daftar penerimanya: segmennya dihitung ulang saat
-- kirim, dan penanda per user sudah tinggal di `bot_notifications`.
create table broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by bigint references users(id) on delete set null,
  segment text not null,
  body text not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint broadcasts_body_present check (length(btrim(body)) > 0)
);
create index broadcasts_created_idx on broadcasts(created_at desc);

-- 3. Saklar dan angka yang pindah dari kode ke panel.
--
-- Semuanya menggeser apa yang dilihat atau didapat user, dan tidak satu pun punya alasan
-- teknis untuk menuntut deploy:
--
--   leaderboardEnabled        <- LEADERBOARD_ENABLED di features/leaderboard/availability.ts
--   mission*Target/Reward     <- MISSIONS di domain/missions.ts
--   withdrawalMinActiveDays   <- REQUIRED_ACTIVE_DAYS di server/payout-rules.ts
--   withdrawalCooldownDays    <- WITHDRAWAL_COOLDOWN_DAYS di domain/premium.ts
--
-- Dua yang terakhir adalah gerbang penarikan, dan itu disengaja: `withdrawalMinActiveReferrals`
-- sudah dipindah ke panel di migrasi 0030 dengan alasan yang persis sama — syarat penarikan
-- yang tidak bisa diuji tanpa deploy adalah syarat yang tidak pernah benar-benar disetel.
-- Keduanya diberi label risiko di panel supaya menurunkannya butuh konfirmasi.
--
-- NILAINYA DITURUNKAN, BUKAN DITULIS MATI. Ini pelajaran migrasi 0028: seed berupa angka
-- mati untuk key yang punya invarian terhadap key lama akan melanggar invariannya sendiri
-- pada baris produksi yang sudah disetel admin, dan karena validasi jalan saat membaca,
-- akibatnya seluruh API menjawab 500 dan panelnya ikut mati — tidak bisa diperbaiki lewat UI.
--
--   withdrawalCooldownDays  >= premiumWithdrawalCooldownDays  (jeda premium harus lebih pendek)
--   mission*Reward          <= maxEnergy                       (hadiah yang tidak muat tidak
--                                                               akan pernah bisa diklaim)
--
-- Pada konfigurasi bawaan ketiganya tidak menggeser apa pun: 7 >= 3, dan 2/2/3 <= 5.
update economy_config
set config = config || jsonb_build_object(
  'leaderboardEnabled', coalesce(config -> 'leaderboardEnabled', to_jsonb(1)),

  'missionTasksTarget', coalesce(config -> 'missionTasksTarget', to_jsonb(5)),
  'missionStarsTarget', coalesce(config -> 'missionStarsTarget', to_jsonb(3)),
  'missionAdsTarget', coalesce(config -> 'missionAdsTarget', to_jsonb(3)),

  'missionTasksReward', least(
    coalesce((config ->> 'missionTasksReward')::int, 2), (config ->> 'maxEnergy')::int),
  'missionStarsReward', least(
    coalesce((config ->> 'missionStarsReward')::int, 2), (config ->> 'maxEnergy')::int),
  'missionAdsReward', least(
    coalesce((config ->> 'missionAdsReward')::int, 3), (config ->> 'maxEnergy')::int),

  'withdrawalMinActiveDays', coalesce(config -> 'withdrawalMinActiveDays', to_jsonb(7)),

  'withdrawalCooldownDays', greatest(
    coalesce((config ->> 'withdrawalCooldownDays')::int, 7),
    (config ->> 'premiumWithdrawalCooldownDays')::int)
)
where id = 1;
