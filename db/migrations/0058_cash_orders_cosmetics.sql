-- Pemasukan QRIS di luar premium: pesanan tunai serba-guna, dua barang berbayar baru, dan rak
-- kosmetik.
--
-- Aturan raknya tidak berubah dari migrasi 0055: barang yang dijual tidak boleh menaikkan plafon
-- payout. Yang ditambahkan di sini lolos dengan alasan masing-masing.
--
--   Pass Gaspol  — soal tidak memotong energi selama jendelanya. Persis argumen tiket iklan di
--                  migrasi 0024: yang dibayar ONGKOS MASUK, bukan hadiah, jadi yang naik cuma
--                  kecepatan user menghabiskan plafonnya sendiri. Kolam reward tetap yang mematok
--                  berapa yang bisa keluar per hari.
--   Tarik Sekarang — melewati jeda antar penarikan sekali. Tidak menambah satu pun credit; yang
--                  berubah KAPAN saldo yang sudah ada boleh keluar. Yang naik biaya transfer per
--                  rupiah, dan itu yang harus ditutup harganya — `validateEconomyConfig`
--                  menegakkan lantainya lewat nilai TD-nya.
--   Kosmetik     — tidak menyentuh ekonomi sama sekali. Marginnya utuh, dan panggungnya papan
--                  peringkat yang memang sudah publik.
--
-- Kenapa tabel pesanan sendiri dan bukan memperlebar `premium_payments`: tabel itu memegang uang
-- yang sudah berjalan di produksi, dan bentuknya premium sampai ke nama kolomnya (`months`,
-- `granted_until`). Melebarkannya berarti mengendurkan `not null` dan check pada tabel yang sedang
-- dipakai, di jendela ketika kode lama masih hidup. `cash_orders` berdiri di sebelahnya dengan
-- alur pelunasan yang bentuknya sama persis, dan premium tetap lewat jalurnya sendiri.

-- ---------------------------------------------------------------------------------------------
-- 1. Paket premium panjang (6 dan 12 bulan)
-- ---------------------------------------------------------------------------------------------
-- Check `months` ditulis inline di migrasi 0027, jadi namanya dibuatkan Postgres. Dicari dulu
-- baru dijatuhkan: menebak namanya lalu memakai `if exists` akan MELEWATKAN penjatuhannya secara
-- diam-diam kalau tebakannya meleset, dan yang terlihat sesudahnya bukan migrasi gagal melainkan
-- checkout 6 bulan yang ditolak database.
do $$
declare nama text;
begin
  select conname into nama
    from pg_constraint
   where conrelid = 'premium_payments'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%months%';
  if nama is null then
    raise exception 'check months di premium_payments tidak ketemu — periksa migrasi 0027';
  end if;
  execute format('alter table premium_payments drop constraint %I', nama);
end $$;

alter table premium_payments add constraint premium_payments_months_valid
  check (months in (1, 2, 3, 6, 12));

-- ---------------------------------------------------------------------------------------------
-- 2. Pesanan tunai serba-guna
-- ---------------------------------------------------------------------------------------------
-- Bentuknya sengaja cermin `premium_payments`, termasuk alasan tiap kolomnya:
--   `signature`        satu-satunya yang membedakan callback asli dari POST karangan ke endpoint
--                      webhook yang URL-nya publik.
--   `amount_idr`       harga barangnya; `total_amount_idr` yang benar-benar ditagih setelah
--                      KlikQRIS menambahkan kode unik. Yang dicocokkan dengan nominal yang dibayar
--                      adalah yang kedua.
--   `product_key`      barang yang dibeli. Tidak dibatasi check di sini: daftarnya tinggal di
--                      `domain/store/store.ts`, dan `startCashCheckout` menolak key yang tidak ada
--                      di katalog sebelum satu baris pun ditulis. Check kedua di database cuma
--                      menyalin daftar yang sama ke tempat yang tidak bisa dibaca kode.
--   `price_credits_at_purchase`  harga TD barangnya SAAT dibeli — bukan yang dibayar (ini jalur
--                      tunai), melainkan nilai yang dilepas user kalau ia menebusnya pakai saldo.
--                      Disimpan supaya rekonsiliasi bisa menjawab "berapa liabilitas yang TIDAK
--                      jadi terbakar karena orang ini memilih bayar tunai".
create table cash_orders (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  order_id text not null unique,
  product_key text not null,
  amount_idr integer not null check (amount_idr > 0),
  total_amount_idr integer not null check (total_amount_idr > 0),
  price_credits_at_purchase integer,
  state text not null default 'pending',
  signature text not null,
  qris_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cash_orders_state_valid check (state in ('pending', 'paid', 'expired', 'failed')),
  constraint cash_orders_paid_shape check (state <> 'paid' or paid_at is not null),
  constraint cash_orders_unpaid_shape check (state = 'paid' or paid_at is null)
);

-- Satu pesanan menganggur per user, ditegakkan indeks dan bukan percabangan `if` — alasan yang
-- sama dengan `premium_payments_one_pending`: tanpa ini user bisa menumpuk QR yang belum dibayar
-- lalu membayar semuanya sekaligus, dan tiap pembayaran menuntut barangnya sendiri.
create unique index cash_orders_one_pending on cash_orders(user_id) where state = 'pending';

create index cash_orders_user_idx on cash_orders(user_id, created_at desc);
create index cash_orders_pending_expiry_idx on cash_orders(expires_at) where state = 'pending';

-- ---------------------------------------------------------------------------------------------
-- 3. Barang berbayar baru
-- ---------------------------------------------------------------------------------------------
-- Jendela Pass Gaspol. Sengaja timestamp, bukan hitungan pass: yang dijual WAKTU, dan pembelian
-- kedua menumpuk dari sisa yang masih berjalan (`greatest(now(), coalesce(...))`), sama seperti
-- `grantPremium`. Tanpa penumpukan itu, membeli saat pass lama masih hidup akan memotong sisanya.
alter table users add column gaspol_until timestamptz;

-- Pelepas jeda penarikan. Penanda waktu, bukan pencacah, dan itu yang membuatnya habis sendiri:
-- `readEligibility` mengabaikan jeda hanya selama penanda ini LEBIH BARU daripada pengajuan
-- terakhir. Begitu pengajuannya masuk, `requested_at` melewatinya dan gerbangnya kembali menutup —
-- tidak ada langkah "konsumsi" terpisah yang bisa gagal setengah jalan, dan tidak ada jatah yang
-- menggantung kalau pengajuannya batal.
alter table users add column withdrawal_cooldown_waived_at timestamptz;

-- ---------------------------------------------------------------------------------------------
-- 4. Kosmetik
-- ---------------------------------------------------------------------------------------------
-- Barang pertama yang benar-benar DIMILIKI, persis yang diantisipasi migrasi 0055. Kepemilikan
-- terpisah dari pemasangan: yang dibeli tidak hilang saat diganti, dan satu baris `users` cukup
-- untuk menjawab "yang dipakai sekarang apa" tanpa menyapu tabel kepemilikan di tiap baris papan
-- peringkat.
--
-- `cosmetic_key` tidak dibatasi check. Katalognya di `domain/store/cosmetics.ts` dan setiap jalur
-- tulis melewati `isCosmeticKey`; check di sini cuma akan menyalin daftar yang sama ke tempat yang
-- menuntut migrasi setiap kali satu bingkai ditambahkan. Yang dijaga database tetap yang bisa
-- merusak: kepemilikan ganda, dan baris yatim saat akunnya dihapus.
create table user_cosmetics (
  user_id bigint not null references users(id) on delete cascade,
  cosmetic_key text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, cosmetic_key)
);

-- Yang sedang dipakai. Dua kolom, bukan satu: bingkai dan gelar tampil bersamaan, jadi memilih
-- yang satu tidak boleh melepas yang lain. `null` = tidak memakai apa-apa, dan itu keadaan bawaan
-- semua orang.
alter table users add column equipped_frame text;
alter table users add column equipped_title text;

-- ---------------------------------------------------------------------------------------------
-- 5. Rak toko yang melebar
-- ---------------------------------------------------------------------------------------------
-- Daftar barang yang boleh masuk `store_purchases` diperluas, bukan diganti. Kosmetik ikut di
-- sini karena ia tetap bisa ditebus pakai TD; jalur QRIS-nya mencatat di `cash_orders`.
alter table store_purchases drop constraint store_purchases_known_item;
alter table store_purchases add constraint store_purchases_known_item check (
  item_key in (
    'energy_refill', 'premium_month', 'gaspol_pass', 'withdraw_skip',
    'frame_emas', 'frame_langit', 'frame_api', 'frame_zamrud',
    'title_sultan', 'title_kilat', 'title_rajin'
  )
);

-- ---------------------------------------------------------------------------------------------
-- 6. Setelan
-- ---------------------------------------------------------------------------------------------
-- Urutan `||` disengaja: objek default di kiri, `config` di kanan. Key yang sudah ada di baris
-- menang, key baru terisi bawaannya. Menukar urutannya akan menimpa setelan admin setiap kali
-- migrasi ini jalan. Nilainya harus sama dengan `DEFAULT_ECONOMY_CONFIG` —
-- `server/economy/economy-config.test.ts` membandingkan keduanya.
--
-- Harga TD tiap barang berbayar sengaja bernilai LEBIH BESAR daripada harga QRIS-nya, sama seperti
-- premium di migrasi 0055: TD adalah liabilitas yang kalau tidak dibelanjakan akan ditarik jadi
-- Rupiah, jadi menebus pakai TD memang harus lebih mahal supaya toko menyerap saldo alih-alih
-- menggantikan pemasukan tunai. `validateEconomyConfig` menegakkan lantainya.
--
-- `storeCosmeticsEnabled = 0` menyembunyikan seluruh rak kosmetik tanpa deploy; barang yang sudah
-- dibeli tetap terpasang. `storeGaspolPriceIdr = 0` dan sejenisnya bukan tombol mati — nilai nol
-- ditolak validasi. Yang mematikan satu barang adalah menutup tokonya atau, untuk kosmetik,
-- saklar di atas.
update economy_config
set config = jsonb_build_object(
  'premiumPrice6Idr', 79900,
  'premiumPrice12Idr', 139900,
  'storeGaspolMinutes', 60,
  'storeGaspolPriceCredits', 40,
  'storeGaspolPriceIdr', 3000,
  'storeWithdrawSkipPriceCredits', 80,
  'storeWithdrawSkipPriceIdr', 5000,
  'storeCosmeticsEnabled', 1,
  'storeFramePriceCredits', 100,
  'storeFramePriceIdr', 7000,
  'storeTitlePriceCredits', 75,
  'storeTitlePriceIdr', 5000
) || config
where id = 1;
