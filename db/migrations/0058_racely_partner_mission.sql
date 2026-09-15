-- Misi partner Racely: pengguna membuka bot lewat tautan referral, memainkan satu ronde, lalu
-- mengonfirmasi sendiri setelah cooldown yang sama dengan misi sosial lain.
alter table mission_claims drop constraint mission_claims_known_key;
alter table mission_claims add constraint mission_claims_known_key check (
  mission_key in (
    'tasks',
    'stars',
    'ads',
    'hard',
    'arcade',
    'variety',
    -- Kunci pensiun tetap sah agar riwayat klaim lama tidak menjadi ilegal surut.
    'twitter_follow',
    'twitter_post',
    'twitter_like_repost',
    'facebook_post',
    'whatsapp_share',
    'whatsapp_channel',
    'tiktok_follow',
    'racely_play'
  )
);

alter table social_mission_attempts drop constraint social_mission_attempts_known_key;
alter table social_mission_attempts add constraint social_mission_attempts_known_key check (
  mission_key in (
    'twitter_follow',
    'twitter_post',
    'twitter_like_repost',
    'facebook_post',
    'whatsapp_share',
    'whatsapp_channel',
    'tiktok_follow',
    'racely_play'
  )
);

-- Hanya sekali seumur akun, sama seperti join WhatsApp dan follow TikTok.
create unique index mission_claims_racely_play_once_idx
  on mission_claims(user_id, mission_key)
  where mission_key = 'racely_play';

-- Reward baru mengikuti misi sekali-per-akun yang sudah ada dan tetap muat di kapasitas energi.
update economy_config
set config = config || jsonb_build_object(
  'missionRacelyReward', least(
    coalesce(
      (config ->> 'missionRacelyReward')::int,
      (config ->> 'missionTiktokFollowReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  )
)
where id = 1;
