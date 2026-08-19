-- Iklan berhadiah: satu tayangan yang selesai ditonton menjadi satu tiket masuk task.
--
-- Yang dicatat tabel ini bukan "user sudah menonton iklan", tapi "ada satu ongkos masuk
-- task yang sudah dibayar dengan cara lain". Hadiahnya sengaja bukan `+1` energi:
-- `applyEnergyGrant` memotong di `maxEnergy()` dan `users_energy_range` mematok
-- `energy <= 10`, jadi hadiah energi hangus tanpa jejak saat energi penuh, dan menulis
-- `energy_updated_at` menggeser jangkar regen sehingga hitungan mundur di UI melompat.
-- Baris tersendiri tidak punya dua cacat itu, dan membuat "task ini dibayar iklan"
-- terbaca di data alih-alih ditebak.
--
-- Yang **tidak** berubah: `readRewardPool` tetap diperiksa sebelum task dimulai dan
-- `consumeQuota` tetap memotong saat menang. Tiket membayar ongkos masuk, bukan hadiah,
-- jadi klaim palsu tidak mencetak satu rupiah pun — yang naik hanya kecepatan user
-- menghabiskan plafonnya sendiri. Karena itu tidak ada jalur dari tabel ini ke
-- `credit_ledger`, dan enum `ledger_kind` tidak ditambah.
--
-- Resolve `show()` dari SDK Adsgram terjadi di klien, dan verifikasi server-ke-server
-- (Reward URL) baru dibuka Adsgram di atas ±50.000 DAU. Selama di bawah ambang itu
-- hadiah selalu berbasis klaim klien, dan pengamannya hanya plafon, cooldown, jejak,
-- serta dua indeks unik parsial di bawah.

create table ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  -- Identitas blok disimpan per baris, bukan diambil dari env saat membaca: blok yang
  -- diganti di masa depan tidak boleh menulis ulang riwayat tayangan yang sudah lewat.
  block_id text not null,
  -- `pending` = sesi dibuka server, tontonan belum dilaporkan. `ready` = pass siap pakai.
  -- `consumed` = sudah membayar satu task. `expired` = kedaluwarsa tanpa dipakai.
  state text not null default 'pending',
  created_at timestamptz not null default now(),
  -- Satu kolom untuk dua umur yang berbeda karena hanya satu yang pernah berjalan pada
  -- satu waktu: selama `pending` ia umur tiket, setelah `ready` ia umur pass.
  expires_at timestamptz not null,
  ready_at timestamptz,
  consumed_at timestamptz,
  constraint ad_views_state_valid check (state in ('pending', 'ready', 'consumed', 'expired')),
  -- Tiket yang masih `pending` tidak boleh punya jam klaim, dan apa pun yang sudah lewat
  -- `pending` harus punya. Tanpa ini, "klaim" bisa ditulis tanpa jejak kapan terjadinya.
  constraint ad_views_ready_needs_time check ((state = 'pending') = (ready_at is null)),
  constraint ad_views_consumed_needs_time check ((state = 'consumed') = (consumed_at is not null))
);

-- Dua indeks ini yang menegakkan "satu iklan = satu task" di database, bukan di kode:
-- satu tiket menganggur dan satu pass siap per user, sehingga stok tidak bisa ditumpuk
-- dan dua permintaan start yang berlomba tidak bisa dibayar oleh pass yang sama.
create unique index ad_views_one_ready on ad_views(user_id) where state = 'ready';
create unique index ad_views_one_pending on ad_views(user_id) where state = 'pending';
-- Kuota harian dihitung dari `created_at` dengan batas hari WIB, bukan dari pemakaian:
-- tayangan yang tiketnya dihidupkan ulang setelah task hangus tidak dihitung dua kali.
create index ad_views_user_idx on ad_views(user_id, created_at desc);

alter table challenges add column ad_view_id uuid references ad_views(id);
-- Satu pass tidak bisa membayar dua challenge. Saat `refundEntry` menghidupkan pass
-- kembali, kolom ini dikosongkan pada challenge yang hangus supaya tiketnya boleh
-- dipakai lagi; riwayat pemakaiannya tetap terbaca di `ad_views`.
create unique index challenges_ad_view_unique on challenges(ad_view_id) where ad_view_id is not null;

-- Migrasi ini **wajib** menyertai deploy kodenya, bukan menyusul: `validateEconomyConfig`
-- jalan juga saat **membaca** baris `economy_config`, dan baris tanpa key baru membuat
-- `loadEconomyConfig` melempar `ECONOMY_CONFIG_INVALID` untuk setiap permintaan — bukan
-- hanya untuk panel admin. Peringatan yang sama ada di `0022` dan `0023`.
--
-- Urutan `||` disengaja: objek default di kiri, `config` di kanan. Key yang sudah ada di
-- baris menang, key baru terisi nilainya. Menukar urutannya menimpa setelan admin dengan
-- bawaan setiap kali migrasi ini jalan.
--
-- `adsMaxViewsPerDay` = 0 berarti fitur mati: tidak ada tiket yang boleh dibuka. Fitur
-- ini menyala lewat panel admin, bukan lewat deploy, dan dimatikan dengan cara yang sama
-- kalau angka di §7 rencananya tidak mendukung. Nilai di bawah harus sama dengan
-- `DEFAULT_ECONOMY_CONFIG` — `server/economy-config.test.ts` membandingkan keduanya.
update economy_config
set config = jsonb_build_object(
  'adsMaxViewsPerDay', 0,
  'adsCooldownSeconds', 120,
  'adsTicketTtlSeconds', 300,
  'adsPassTtlMinutes', 30
) || config
where id = 1;
