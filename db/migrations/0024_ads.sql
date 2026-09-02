-- Iklan Adsgram membayar ongkos masuk task, bukan menambah energi atau credit. | Satu tayangan berhadiah = satu tiket = satu `startChallenge` yang tidak memotong energi. | Yang tidak berubah: `readRewardPool` tetap diperiksa sebelum task dimulai dan | `consumeQuota` tetap memotong saat menang. Tiket membayar *ongkos masuk*, bukan hadiah, | jadi klaim palsu tidak mencetak satu Rupiah pun — yang naik hanya kecepatan user | menghabiskan plafonnya sendiri. Alasan lengkapnya dicatat di bagian Ekonomi pada `docs/keputusan-desain.md`. | Kenapa tabel sendiri, bukan `+1` ke `users.energy`: `applyEnergyGrant` memotong di | `maxEnergy()` dan `users_energy_range` (migrasi `0009`) mematok `energy <= 10`, jadi | hadiah energi hangus tanpa jejak saat energi penuh. `applyEnergyGrant` juga menulis | `energy_updated_at`, yang menggeser jangkar regen dan membuat hitung mundur di UI | melompat. Baris tiket tidak menyentuh dua-duanya. | Migrasi ini **wajib** menyertai deploy kodenya, bukan menyusul: `validateEconomyConfig` | jalan juga saat membaca baris `economy_config`, dan baris tanpa key baru membuat | `loadEconomyConfig` melempar `ECONOMY_CONFIG_INVALID` untuk setiap permintaan.

create table ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  block_id text not null,
  -- pending: tiket dibuka, iklan belum dilaporkan selesai. | ready:   klaim diterima, pass siap membayar satu task. | consumed: pass sudah membayar satu challenge. | expired: tiket atau pass lewat umurnya tanpa dipakai.
  state text not null default 'pending',
  created_at timestamptz not null default now(),
  -- Satu kolom untuk dua umur berbeda: selama 'pending' ia umur tiket | (`adsTicketTtlSeconds`), setelah 'ready' ia umur pass (`adsPassTtlMinutes`). | Keduanya tidak pernah berlaku bersamaan, jadi dua kolom cuma menambah cara | mereka bisa tidak sinkron.
  expires_at timestamptz not null,
  ready_at timestamptz,
  consumed_at timestamptz,
  constraint ad_views_state_valid check (state in ('pending','ready','consumed','expired')),
  -- Ditulis per state, bukan sebagai satu kesetaraan, karena 'expired' bisa datang dari | dua arah: tiket yang tidak pernah diklaim (ready_at masih null) dan pass yang tidak | pernah dipakai (ready_at sudah terisi). Bentuk `(state='pending') = (ready_at is null)` | menolak yang pertama.
  constraint ad_views_pending_shape
    check (state <> 'pending' or (ready_at is null and consumed_at is null)),
  constraint ad_views_ready_shape
    check (state <> 'ready' or (ready_at is not null and consumed_at is null)),
  constraint ad_views_consumed_shape
    check (state <> 'consumed' or (ready_at is not null and consumed_at is not null)),
  constraint ad_views_expired_shape
    check (state <> 'expired' or consumed_at is null)
);

-- Dua indeks parsial ini yang menegakkan "satu iklan = satu task" di database, bukan di | kode: satu tiket menganggur dan satu pass siap per user. Stok tidak bisa ditumpuk, dan | klaim yang balapan kalah di indeks, bukan di percabangan `if`.
create unique index ad_views_one_ready on ad_views(user_id) where state = 'ready';
create unique index ad_views_one_pending on ad_views(user_id) where state = 'pending';
create index ad_views_user_idx on ad_views(user_id, created_at desc);

alter table challenges add column ad_view_id uuid references ad_views(id);

-- Filter `energy_refunded_at is null` disengaja: saat task hangus tanpa percobaan, | `refundEntry` menghidupkan kembali pass-nya, dan tiket yang sama harus boleh membayar | challenge berikutnya. `challenges.ad_view_id` sengaja **tidak** dikosongkan supaya | jejak "challenge ini pernah dibayar iklan" tetap terbaca, dan supaya constraint di | bawah masih punya kolom yang membuktikan ongkos masuknya pernah dibayar.
create unique index challenges_ad_view_unique on challenges(ad_view_id)
  where ad_view_id is not null and energy_refunded_at is null;

-- Penjaga dari migrasi `0009` diperluas, bukan dilepas. Artinya bergeser dari "refund | butuh energi yang dipotong" menjadi "refund butuh ongkos masuk yang pernah dibayar" — | energi atau tiket. Melepasnya berarti tidak ada lagi yang menghalangi energi dicetak | dari udara lewat baris challenge yang tidak pernah membayar apa pun.
alter table challenges drop constraint challenges_energy_refund_needs_spend;
alter table challenges add constraint challenges_entry_refund_needs_entry
  check (energy_refunded_at is null or energy_spent_at is not null or ad_view_id is not null);

-- Urutan `||` disengaja: objek default di kiri, `config` di kanan. Key yang sudah ada di | baris menang, key baru terisi bawaannya. Menukar urutannya akan menimpa setelan admin | setiap kali migrasi ini jalan. Nilainya harus sama dengan `DEFAULT_ECONOMY_CONFIG` — | `server/economy-config.test.ts` membandingkan keduanya. | `adsMaxViewsPerDay = 0` mematikan seluruh fitur tanpa deploy: tiket tidak bisa dibuka, | tombolnya tidak dirender. Itu tombol matinya, bukan revert.
update economy_config
set config = jsonb_build_object(
  'adsMaxViewsPerDay', 10,
  'adsCooldownSeconds', 120,
  'adsTicketTtlSeconds', 300,
  'adsPassTtlMinutes', 30
) || config
where id = 1;
