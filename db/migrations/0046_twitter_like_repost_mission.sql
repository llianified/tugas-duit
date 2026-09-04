-- Like dan repost sengaja menjadi satu misi: user membuka satu post yang sama, melakukan
-- kedua aksi di sana, lalu melewati alur konfirmasi sosial yang sudah ada. Post-nya tetap,
-- jadi klaim hanya boleh sekali sepanjang umur akun, bukan kembali tersedia setiap hari.
alter table mission_claims drop constraint mission_claims_known_key;
alter table mission_claims add constraint mission_claims_known_key check (
  mission_key in (
    'tasks',
    'stars',
    'ads',
    'twitter_follow',
    'twitter_post',
    'facebook_post',
    'twitter_like_repost'
  )
);

alter table social_mission_attempts drop constraint social_mission_attempts_known_key;
alter table social_mission_attempts add constraint social_mission_attempts_known_key check (
  mission_key in ('twitter_follow', 'twitter_post', 'facebook_post', 'twitter_like_repost')
);

create unique index mission_claims_twitter_like_repost_once_idx
  on mission_claims(user_id, mission_key)
  where mission_key = 'twitter_like_repost';

-- Mulai dari reward post Twitter yang sudah dipilih admin agar penambahan misi tidak
-- menyelundupkan angka ekonomi baru. Runtime tetap punya fallback 1 selama deploy/migrasi.
update economy_config
set config = config || jsonb_build_object(
  'missionTwitterLikeRepostReward', least(
    coalesce(
      (config ->> 'missionTwitterLikeRepostReward')::int,
      (config ->> 'missionTwitterPostReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  )
)
where id = 1;
