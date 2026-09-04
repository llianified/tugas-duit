-- Migrasi 0044 sempat menyemai satu key lama `missionSocialReward`, sementara runtime dan
-- panel admin sudah membaca tiga key terpisah. Salin nilai lama hanya untuk key yang belum
-- ada, pertahankan perubahan admin yang sudah tersimpan, lalu buang key yatimnya. Setiap
-- reward tetap dibatasi kapasitas energi biasa agar hasilnya langsung lolos validasi runtime.
update economy_config
set config = (config - 'missionSocialReward') || jsonb_build_object(
  'missionTwitterFollowReward', least(
    coalesce(
      (config ->> 'missionTwitterFollowReward')::int,
      (config ->> 'missionSocialReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  'missionTwitterPostReward', least(
    coalesce(
      (config ->> 'missionTwitterPostReward')::int,
      (config ->> 'missionSocialReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  'missionFacebookPostReward', least(
    coalesce(
      (config ->> 'missionFacebookPostReward')::int,
      (config ->> 'missionSocialReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  )
)
where id = 1;
