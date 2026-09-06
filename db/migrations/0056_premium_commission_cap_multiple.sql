-- `premiumDailyCommissionCapIdr` dinormalkan jadi kelipatan `creditValueIdr`.
--
-- Migrasi ini WAJIB mendahului kode yang menambahkan aturannya ke `validateEconomyConfig`, dan
-- urutan itu memang yang dijamin `vercel-build`: migrasi jalan sebelum `next build`. Sebabnya
-- aturan kelipatan bukan cuma menjaga masukan admin — `parseRow` memvalidasi ulang baris yang
-- SUDAH tersimpan pada setiap `loadEconomyConfig`, jadi satu nilai lama yang bukan kelipatan akan
-- membuat seluruh API menjawab `ECONOMY_CONFIG_INVALID` begitu kodenya live. Dinormalkan lebih
-- dulu di sini, barisnya lolos aturan baru sejak detik pertama.
--
-- Yang diperbaiki bukan sekadar bentuk. `dailyCommissionCreditCap()` membagi angka ini dengan
-- `creditValueIdr`, dan hasil pecahan mengalir ke `consumeCommissionQuota` sebagai `payable`
-- pecahan — lalu menabrak `daily_quotas.commission_credits` yang integer sejak migrasi 0011.
-- Errornya (`invalid input syntax for type integer: "0.5"`) terjadi di dalam transaksi
-- `submitAnswer`, jadi yang batal bukan komisinya saja melainkan seluruh penyelesaian soal: setiap
-- downline dari upline itu dijawab 500 sampai hari WIB berganti. Empat field rupiah lain sudah
-- dijaga aturan kelipatan sejak awal; yang ini terlewat saat premium menambahkan plafonnya sendiri
-- di migrasi 0052.
--
-- Dibulatkan ke BAWAH: plafon komisi adalah batas atas liabilitas harian, dan membulatkannya naik
-- berarti migrasi diam-diam menaikkan biaya. Lantainya plafon non-premium, karena
-- `validateEconomyConfig` juga menuntut plafon premium tidak pernah di bawah plafon biasa — dan
-- nilai itu sudah dijamin kelipatan oleh aturan yang sudah ada.
update economy_config
set config = config || jsonb_build_object(
  'premiumDailyCommissionCapIdr',
  greatest(
    (
      floor(
        coalesce((config ->> 'premiumDailyCommissionCapIdr')::numeric, 12000)
        / nullif((config ->> 'creditValueIdr')::numeric, 0)
      ) * (config ->> 'creditValueIdr')::numeric
    )::int,
    coalesce((config ->> 'dailyCommissionCapIdr')::int, 6000)
  )
)
where id = 1
  and (config ->> 'creditValueIdr') is not null
  and coalesce((config ->> 'premiumDailyCommissionCapIdr')::numeric, 12000)
      % (config ->> 'creditValueIdr')::numeric <> 0;
