-- Energi: tempo kunjungan, bukan plafon bayaran.
--
-- Masuk satu task memotong 1 energi, dan energi terisi kembali 1 per 60 menit tanpa
-- reset harian. Yang diatur karena itu adalah **kapan** user datang (5 sekaligus, lalu
-- satu per jam), bukan berapa total yang ia dapat sehari — plafon rupiah tetap milik
-- `daily_quotas` + `DAILY_CREDIT_CAP` di `domain/economy.ts`. Dua penjaga yang berbeda
-- pekerjaan; menghapus salah satunya tidak digantikan yang lain.

alter table users
  add column energy smallint not null default 5,
  -- Jam acuan regen, bukan "kapan terakhir dipakai": `projectEnergy` memajukannya
  -- hanya sebanyak energi yang benar-benar diberikan (`gained * 60 menit`), sehingga
  -- sisa menit tidak hangus dan user yang membuka app tiap 59 menit tetap bertambah.
  add column energy_updated_at timestamptz not null default now(),
  -- Batas atas 10, bukan 5: plafon *aturan* tinggal di `domain/energy.ts` supaya
  -- menaikkan kapasitas (mis. tier berbayar) tidak menuntut migrasi. Yang dijaga
  -- constraint ini cuma hal yang selalu salah: energi negatif atau membengkak.
  add constraint users_energy_range check (energy >= 0 and energy <= 10);

-- Penanda per soal, bukan penghitung: refund harus idempoten dan harus bisa ditelusuri
-- ke soal yang membayarinya.
--
-- `energy_spent_at` juga yang membuat pemotongan idempoten. Sifat itu sudah dijaga
-- `coalesce(started_at, now())` di `startChallenge` — user boleh keluar-masuk soal yang
-- sama tanpa menggeser titik nol timer — dan kolom ini menyatakan hal yang sama untuk
-- energinya: soal yang sudah dibayar tidak pernah dibayar dua kali.
--
-- Tidak ada tabel `energy_ledger`: satu-satunya pembelanja energi adalah
-- `challenges`, jadi dua kolom ini sudah menjadi jejak audit yang cukup.
alter table challenges
  add column energy_spent_at timestamptz,
  add column energy_refunded_at timestamptz,
  -- Refund tanpa pemotongan yang mendahuluinya adalah energi yang dicetak dari udara.
  add constraint challenges_energy_refund_needs_spend
    check (energy_refunded_at is null or energy_spent_at is not null);
