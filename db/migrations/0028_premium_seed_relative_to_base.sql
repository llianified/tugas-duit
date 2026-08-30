-- Perbaikan darurat untuk migrasi 0027: seed premium yang menabrak setelan admin.
--
-- Migrasi 0027 menulis nilai premium sebagai angka mati (`premiumEnergyRegenMinutes`
-- 25, `premiumMaxTasksPerDay` 1000) — angka yang benar hanya kalau nilai dasarnya
-- masih bawaan. Produksi sudah lama disetel lewat panel admin ke
-- `energyRegenMinutes` 10 dan `maxTasksPerDay` 7500, jadi seed itu melanggar dua
-- invarian yang diperkenalkan bersamaan dengannya:
--
--   premiumEnergyRegenMinutes <= energyRegenMinutes
--   premiumMaxTasksPerDay     >= maxTasksPerDay
--
-- Akibatnya fatal, bukan kosmetik: `validateEconomyConfig` dijalankan **saat
-- membaca** baris (lihat kepala migrasi 0016), jadi `loadEconomyConfig` melempar
-- `ECONOMY_CONFIG_INVALID` di awal setiap request dan seluruh API menjawab 500.
-- Panel admin ikut mati karena `readEconomyConfigSnapshot` memakai `parseRow` yang
-- sama — artinya baris ini tidak bisa diperbaiki lewat UI, dan migrasi adalah
-- satu-satunya jalan pulih.
--
-- Pelajarannya: seed untuk key baru yang punya invarian terhadap key lama tidak
-- boleh berupa angka mati. Ia harus diturunkan dari nilai yang benar-benar ada di
-- baris itu.
--
-- Ketiga ekspresi di bawah dipilih supaya hanya bergerak ke arah yang aman dan
-- **tidak mengubah apa pun pada konfigurasi bawaan** — jadi instalasi baru yang
-- baru saja menjalankan 0027 tidak tergeser sedikit pun:
--
--   premiumMaxEnergy           hanya naik   (60 → tetap 10 pada bawaan)
--   premiumEnergyRegenMinutes  hanya turun  (base 60 → tetap 25; base 10 → 5)
--   premiumMaxTasksPerDay      hanya naik   (base 300 → tetap 1000; base 7500 → 15000)
--
-- Setelan premium yang sudah sengaja diubah admin karena itu tidak pernah
-- diperlemah: yang naik tidak pernah turun, yang turun tidak pernah naik.
update economy_config
set config = config || jsonb_build_object(
  -- Kapasitas energi premium tidak boleh di bawah kapasitas biasa. Batas atas 10
  -- datang dari constraint `users_energy_range` di migrasi 0009, dan `maxEnergy`
  -- sendiri tidak boleh melewatinya, jadi `greatest` di sini tidak bisa tembus.
  'premiumMaxEnergy',
    greatest(
      (config->>'premiumMaxEnergy')::int,
      (config->>'maxEnergy')::int
    ),

  -- Regen premium harus paling lambat sama dengan regen biasa. Setengah interval
  -- dasar dipakai supaya premium tetap terasa dua kali lebih cepat pada baris yang
  -- regen dasarnya sudah pendek, bukan sekadar dijepit jadi sama persis.
  'premiumEnergyRegenMinutes',
    least(
      (config->>'premiumEnergyRegenMinutes')::int,
      greatest(1, ceil((config->>'energyRegenMinutes')::numeric / 2)::int)
    ),

  -- Plafon anti-bot premium tidak boleh di bawah plafon biasa. Dua kali lipat,
  -- dijepit di batas atas field (100000) supaya hasilnya tetap lolos validasi
  -- walau `maxTasksPerDay` sudah berada di batas itu.
  'premiumMaxTasksPerDay',
    least(
      100000,
      greatest(
        (config->>'premiumMaxTasksPerDay')::int,
        (config->>'maxTasksPerDay')::int * 2
      )
    )
)
where id = 1;
