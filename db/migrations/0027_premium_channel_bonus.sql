-- Langganan premium + bonus join channel Telegram.
--
-- Dua fitur, satu migrasi, karena keduanya menambah kolom ke `users` dan sama-sama
-- menuntut key baru di `economy_config` — memisahnya berarti dua kali update baris
-- konfigurasi yang sama.
--
-- Yang **tidak** diubah fitur premium: laju isi ulang kolam reward. Premium menambah
-- kapasitas, kecepatan energi, dan plafon anti-bot — semuanya soal *kecepatan* dan
-- *kenyamanan*, bukan berapa total yang bisa dihasilkan per hari. Itu disengaja: kolam
-- mengisi 30 credit/hari (Rp3.000), jadi Rp90.000/bulan sudah jadi langit-langit
-- penghasilan satu akun. Premium seharga Rp19.900/bulan yang menaikkan langit-langit
-- itu akan membayar lebih besar daripada yang diterima. Kalau suatu saat mau diubah,
-- yang disetel adalah `rewardPoolRegenMinutes`/`rewardPoolRegenCredits` untuk semua
-- orang, bukan bonus regen khusus premium.

-- Kapan langganan berakhir. `null` = belum pernah premium. Baris masa lalu tetap
-- tersimpan (tidak dikosongkan saat lewat) supaya "pernah premium" terbaca di data,
-- dan perpanjangan menumpuk dari tanggal berakhir yang masih berlaku, bukan dari now().
alter table users add column premium_until timestamptz;

create index users_premium_until_idx on users(premium_until)
  where premium_until is not null;

-- Penanda klaim bonus channel. Idempotensi sebenarnya sudah dijamin
-- `credit_ledger.idempotency_key` ('channel_bonus:<user_id>'); kolom ini ada supaya
-- kartu di beranda tahu harus tampil atau tidak tanpa menyapu ledger tiap request.
alter table users add column channel_bonus_claimed_at timestamptz;

-- Tagihan QRIS KlikQRIS.
--
-- `signature` disimpan dari response /qris/create dan dibandingkan dengan signature
-- yang datang di webhook. Itu satu-satunya yang membedakan callback asli dari POST
-- karangan ke endpoint webhook yang URL-nya publik.
--
-- `amount_idr` adalah harga paketnya; `total_amount_idr` adalah yang benar-benar
-- ditagih setelah KlikQRIS menambahkan kode unik. Dua kolom karena keduanya dipakai
-- untuk hal berbeda: yang pertama untuk pembukuan, yang kedua untuk dicocokkan dengan
-- nominal yang dibayar user.
create table premium_payments (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  order_id text not null unique,
  months smallint not null check (months in (1, 2, 3)),
  amount_idr integer not null check (amount_idr > 0),
  total_amount_idr integer not null check (total_amount_idr > 0),
  state text not null default 'pending',
  signature text not null,
  qris_url text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  -- Sampai kapan langganan diperpanjang oleh pembayaran ini. Ditulis sekali saat
  -- transisi ke 'paid', jadi webhook yang datang dua kali tidak bisa memperpanjang
  -- dua kali — pengecekannya `state='pending'`, bukan "sudah pernah dikirim?".
  granted_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_payments_state_valid
    check (state in ('pending', 'paid', 'expired', 'failed')),
  constraint premium_payments_paid_shape
    check (state <> 'paid' or (paid_at is not null and granted_until is not null)),
  constraint premium_payments_unpaid_shape
    check (state = 'paid' or (paid_at is null and granted_until is null))
);

-- Satu tagihan menganggur per user, ditegakkan indeks dan bukan percabangan `if`.
-- Tanpa ini user bisa menumpuk QR yang belum dibayar lalu membayar semuanya sekaligus
-- di menit terakhir, dan tiap pembayaran menuntut perpanjangan sendiri.
create unique index premium_payments_one_pending on premium_payments(user_id)
  where state = 'pending';

create index premium_payments_user_idx on premium_payments(user_id, created_at desc);
create index premium_payments_pending_expiry_idx on premium_payments(expires_at)
  where state = 'pending';

-- Urutan `||` disengaja: objek default di kiri, `config` di kanan. Key yang sudah ada
-- di baris menang, key baru terisi bawaannya. Menukar urutannya akan menimpa setelan
-- admin setiap kali migrasi ini jalan. Nilainya harus sama dengan
-- `DEFAULT_ECONOMY_CONFIG` — `server/economy-config.test.ts` membandingkan keduanya.
--
-- `channelJoinBonusCredits = 0` mematikan kartu join channel tanpa deploy.
update economy_config
set config = jsonb_build_object(
  'channelJoinBonusCredits', 25,
  'premiumPrice1Idr', 19900,
  'premiumPrice2Idr', 34900,
  'premiumPrice3Idr', 44900,
  'premiumMaxEnergy', 10,
  'premiumEnergyRegenMinutes', 25,
  'premiumPoolCapBonus', 15,
  'premiumMaxTasksPerDay', 1000,
  'premiumWithdrawalCooldownDays', 3
) || config
where id = 1;
