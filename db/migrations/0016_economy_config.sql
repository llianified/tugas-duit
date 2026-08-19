-- Konfigurasi ekonomi yang bisa disetel dari panel admin, beserta jejak auditnya.
--
-- Yang disimpan di sini **hanya besaran**, bukan aturan. Integritas ledger,
-- mutasi saldo, idempotensi, autentikasi, otorisasi, state machine penarikan,
-- constraint tabel lain, dan sinyal fraud tetap tinggal di kode dan di database —
-- tidak ada nilai di tabel ini yang bisa dipakai melewati satu pun di antaranya.
--
-- Bentuknya `jsonb` satu kolom, bukan satu kolom per parameter. Alasannya bukan
-- kemalasan: dua puluh tujuh kolom integer berarti satu migrasi setiap kali ada
-- parameter baru, dan jejak audit di bawah harus tahu nama kolomnya satu per
-- satu. Yang biasanya hilang saat memilih JSON — validasi — tidak hilang di sini:
-- `validateEconomyConfig` di `domain/economy-config.ts` memeriksa setiap field,
-- rentangnya, dan hubungan antar-field, dan ia dijalankan **baik saat menulis
-- maupun saat membaca**. Baris yang disunting tangan lewat psql karena itu tidak
-- bisa menyelundupkan nilai yang ditolak aplikasi: pembacaannya gagal keras, dan
-- server menolak melayani alih-alih menebak besaran uang.

create table economy_config (
  -- Satu baris, ditegakkan constraint dan bukan kesepakatan. Konfigurasi kedua
  -- berarti dua sumber kebenaran, dan yang paling mungkin terjadi adalah panel
  -- admin menyunting baris yang tidak dibaca server.
  id smallint primary key default 1 check (id = 1),
  config jsonb not null,
  -- Penghitung untuk penguncian optimistis. Panel admin mengirimkan versi yang
  -- dibacanya; update yang versinya tidak cocok tidak mengubah apa pun dan
  -- dijawab 409. Tanpa ini, dua admin yang membuka form bersamaan akan saling
  -- menimpa dalam diam — yang menyimpan belakangan menang, dan perubahan yang
  -- pertama hilang tanpa jejak selain audit yang menunjukkan nilainya kembali.
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by bigint references users(id) on delete set null
);

-- Jejak audit: satu baris per **field** yang berubah, bukan satu baris per
-- penyimpanan.
--
-- Bentuk itu yang membuat pertanyaan yang sebenarnya diajukan orang bisa dijawab
-- — "kapan plafon harian naik, dari berapa, oleh siapa" — tanpa harus membaca
-- diff dua dokumen JSON. Nilai disimpan sebagai teks karena yang dicatat adalah
-- apa yang tertulis saat itu, bukan angka untuk dihitung ulang.
create table economy_config_audit (
  id bigint generated always as identity primary key,
  -- `set null`, bukan `restrict`: baris audit harus bertahan melampaui akun yang
  -- membuatnya. Riwayat perubahan uang yang ikut terhapus bersama adminnya adalah
  -- riwayat yang justru hilang saat paling dibutuhkan.
  changed_by bigint references users(id) on delete set null,
  changed_at timestamptz not null default now(),
  field text not null,
  old_value text not null,
  new_value text not null,
  -- Versi yang dihasilkan penyimpanan ini, supaya baris-baris dari satu
  -- penyimpanan yang sama bisa dikelompokkan kembali.
  version integer not null
);
create index economy_config_audit_changed_idx on economy_config_audit(changed_at desc);

-- Baris pertama = nilai yang berlaku **sebelum** sistem konfigurasi ini ada.
--
-- Ini syarat migrasinya: menyalakan fitur ini tidak boleh menggeser satu rupiah
-- pun bagi user yang sedang berjalan. Angka di bawah harus sama persis dengan
-- `DEFAULT_ECONOMY_CONFIG` di `domain/economy-config.ts`, dan
-- `server/economy-config.test.ts` membandingkan keduanya supaya keduanya tidak
-- bisa menyimpang diam-diam.
insert into economy_config (id, config) values (1, jsonb_build_object(
  'creditValueIdr', 100,
  'baseDailyCapIdr', 3000,
  'rankDailyCapBonus', 3,
  'streakCapStepDays', 7,
  'maxStreakCapBonus', 4,
  'maxTasksPerDay', 300,
  'parTimeEasyMs', 10000,
  'parTimeMediumMs', 18000,
  'parTimeHardMs', 28000,
  'rewardEasy1', 1,
  'rewardEasy2', 2,
  'rewardEasy3', 3,
  'rewardMedium1', 2,
  'rewardMedium2', 3,
  'rewardMedium3', 5,
  'rewardHard1', 3,
  'rewardHard2', 6,
  'rewardHard3', 9,
  'maxEnergy', 5,
  'energyRegenMinutes', 60,
  'energyCostPerTask', 1,
  'withdrawalMinimumIdr', 10000,
  'maxPayoutIdr', 2000000000,
  'referralCommissionPercent', 10,
  'dailyCommissionCapIdr', 6000,
  'rankTier2Tasks', 100,
  'rankTier3Tasks', 300,
  'rankTier4Tasks', 700,
  'rankTier5Tasks', 1500
));
