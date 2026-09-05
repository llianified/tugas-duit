-- Tiga misi otomatis baru, dan undian harian yang menggantikan susunan tetap.
--
-- Alasannya isi, bukan ekonomi: susunan misi sebelumnya sama persis tiap hari, jadi hari ke-14
-- terlihat identik dengan hari pertama. Dengan kolam enam yang diambil tiga, ada dua puluh
-- susunan yang mungkin — dan undiannya sama untuk semua user pada hari yang sama, supaya "misi
-- hari ini" tetap jadi sesuatu yang bisa dibicarakan bersama di channel.
alter table mission_claims drop constraint mission_claims_known_key;
alter table mission_claims add constraint mission_claims_known_key check (
  mission_key in (
    'tasks',
    'stars',
    'ads',
    'hard',
    'arcade',
    'variety',
    'twitter_follow',
    'twitter_post',
    'facebook_post',
    'twitter_like_repost'
  )
);

-- Angka barunya diturunkan dari yang sudah dipilih admin, bukan dipatok di sini, supaya menambah
-- misi tidak menyelundupkan besaran ekonomi baru ke baris produksi. Hadiah dijepit di kapasitas
-- energi karena `claimMission` menolak hadiah yang tidak muat utuh — misi yang hadiahnya kelebihan
-- tidak akan pernah bisa diambil siapa pun, dan gagalnya diam.
--
-- Target Arena ikut dijepit jatah main hariannya dengan alasan yang sama: misi yang menuntut lebih
-- banyak ronde daripada yang boleh dimainkan berhenti di N/M selamanya.
update economy_config
set config = config || jsonb_build_object(
  'missionHardTarget', coalesce((config ->> 'missionHardTarget')::int, 5),
  'missionHardReward', least(
    coalesce((config ->> 'missionHardReward')::int, (config ->> 'missionTasksReward')::int, 2),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  'missionArcadeTarget', least(
    coalesce((config ->> 'missionArcadeTarget')::int, 2),
    greatest(coalesce((config ->> 'arcadeMaxPlaysPerDay')::int, 3), 1)
  ),
  'missionArcadeReward', least(
    coalesce((config ->> 'missionArcadeReward')::int, (config ->> 'missionTasksReward')::int, 2),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  'missionVarietyTarget', least(coalesce((config ->> 'missionVarietyTarget')::int, 3), 3),
  'missionVarietyReward', least(
    coalesce((config ->> 'missionVarietyReward')::int, (config ->> 'missionTasksReward')::int, 2),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  -- Tiga menjaga jumlah misi yang terbit sama seperti sebelum rotasi ada; yang berubah hanya
  -- misi mana yang kebagian. Deploy-nya karena itu netral untuk beban harian user.
  'missionDailyCount', coalesce((config ->> 'missionDailyCount')::int, 3)
)
where id = 1;
