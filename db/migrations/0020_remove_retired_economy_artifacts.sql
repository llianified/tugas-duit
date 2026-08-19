-- Bersihkan artefak fitur lama pada deployment yang telah menjalankan migrasi
-- terdahulu. Kedua operasi idempoten agar bootstrap baru juga aman.
drop table if exists ad_views;

update economy_config
set config = config - array[
  'adRewardEnergy',
  'adDailyLimit',
  'adCooldownSeconds',
  'adMinWatchSeconds',
  'adTicketTtlSeconds'
]::text[]
where id = 1;
