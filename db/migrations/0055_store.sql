-- Toko TD: satu-satunya jalur yang mengurangi saldo user tanpa membayarkannya sebagai Rupiah.
--
-- Arahnya kebalikan dari seluruh ledger yang ada. Task, komisi, dan pengembalian penarikan
-- menambah saldo; penahanan penarikan menguranginya tapi mengembalikannya sebagai uang. Belanja
-- menghapusnya begitu saja — TD yang dibelanjakan tidak pernah kembali sebagai penarikan, dan itu
-- gunanya.

-- Tanda `amount` untuk 'purchase' dikunci NEGATIF, sejajar dengan 'withdrawal_hold'. Tanpa baris
-- ini database menerima belanja yang justru MENAMBAH saldo — ledger yang tetap berjumlah benar
-- sambil menceritakan hal yang tidak pernah terjadi, persis yang diperingatkan migrasi 0014.
alter table credit_ledger drop constraint credit_ledger_amount_sign;
alter table credit_ledger add constraint credit_ledger_amount_sign check (
  (kind in ('task', 'commission', 'withdrawal_refund') and amount > 0)
  or (kind in ('withdrawal_hold', 'purchase') and amount < 0)
  or kind = 'adjustment'
);

-- Catatan kepemilikan, bukan sekadar jejak. Energi dan premium habis dipakai, jadi untuk keduanya
-- tabel ini murni audit — tapi barang kosmetik yang menyusul justru DIMILIKI, dan barisnya yang
-- akan menjawab "apa saja yang punya user ini". Dibuat sekarang supaya jenis barang berikutnya
-- cukup menambah nilai di constraint, bukan menambah tabel.
--
-- `ledger_id` menghubungkan tiap pembelian ke baris ledger yang membayarnya. Sama seperti
-- `withdrawals.hold_ledger_id`: tidak dibaca saat melayani request, dipakai saat rekonsiliasi.
create table store_purchases (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  item_key text not null,
  -- Kunci idempotensi milik satu KLIK, datang dari klien. Alasannya sama dengan koreksi admin di
  -- `recordAdjustment`: belanja tidak punya id alami seperti `task:<challengeId>`, jadi yang
  -- menandai "pembelian yang sama" cuma satu tap yang sama.
  --
  -- Yang membuatnya WAJIB di sini, bukan sekadar berguna: idempotensi `appendLedger` menjaga
  -- ledger, bukan efeknya. Kunci yang sudah ada membuatnya kembali lebih awal tanpa memotong
  -- saldo — sementara pemberian energi atau premium sesudahnya tetap jalan. Tanpa baris ini,
  -- satu tap ganda dibayar sekali dan diterima dua kali.
  request_id text not null,
  -- Harga SAAT DIBELI, bukan harga sekarang. Panel admin boleh mengubah harga kapan saja, dan
  -- riwayat yang menghitung ulang dari harga berjalan akan berbohong tentang masa lalu — alasan
  -- yang sama membuat `withdrawals.amount_idr` membekukan kursnya di migrasi 0013.
  price_credits integer not null check (price_credits > 0),
  ledger_id bigint not null references credit_ledger(id),
  created_at timestamptz not null default now(),
  constraint store_purchases_known_item check (item_key in ('energy_refill', 'premium_month'))
);
create unique index store_purchases_request_idx on store_purchases(user_id, request_id);
create index store_purchases_user_created_idx on store_purchases(user_id, created_at desc);

-- Harga premium di TD diturunkan dari harga tunainya, bukan dipatok di sini: 25% di atas nilai
-- tunai sebulan, supaya QRIS tetap jalur termurah dan toko tidak menggantikan pendapatan tunai.
-- `validateEconomyConfig` menegakkan lantainya, migrasi ini cuma memilih titik awal yang wajar.
--
-- Isi energi dijepit kapasitas energi yang sedang berlaku. Isi yang tidak muat utuh membuat
-- barangnya mustahil dibeli — alasan yang sama seperti hadiah misi di migrasi 0048, dan gagalnya
-- sama diamnya.
update economy_config
set config = config || jsonb_build_object(
  'storeEnabled', coalesce((config ->> 'storeEnabled')::int, 1),
  'storeEnergyPriceCredits', coalesce((config ->> 'storeEnergyPriceCredits')::int, 10),
  'storeEnergyAmount', least(
    coalesce((config ->> 'storeEnergyAmount')::int, 3),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  'storePremiumMonthPriceCredits', greatest(
    coalesce(
      (config ->> 'storePremiumMonthPriceCredits')::int,
      -- Dibulatkan NAIK ke puluhan: 199 x 1,25 = 248,75, dan "249 TD" terbaca seperti angka yang
      -- bocor dari kalkulator, bukan seperti harga. Pembulatannya juga yang membuat nilai ini sama
      -- persis dengan bawaan di `DEFAULT_ECONOMY_CONFIG` — dua sumber yang menyimpang di jalur
      -- harga adalah persis yang dijaga test seed config.
      (ceil(
        (config ->> 'premiumPrice1Idr')::numeric
        / nullif((config ->> 'creditValueIdr')::numeric, 0)
        * 1.25
        / 10
      ) * 10)::int,
      250
    ),
    ceil(
      (config ->> 'premiumPrice1Idr')::numeric
      / nullif((config ->> 'creditValueIdr')::numeric, 0)
    )::int
  )
)
where id = 1;
