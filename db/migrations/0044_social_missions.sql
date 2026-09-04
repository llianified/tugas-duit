-- Tiga misi sosial memakai tabel klaim yang sama agar pemberian energi tetap atomik dan
-- idempotent. Follow X hanya boleh sekali untuk umur akun; dua post memakai primary key
-- harian yang sudah ada. Constraint key diperluas bersama deploy kode supaya API tidak
-- pernah mencoba menulis nilai yang belum dikenal database.
alter table mission_claims drop constraint mission_claims_known_key;
alter table mission_claims add constraint mission_claims_known_key check (
  mission_key in ('tasks', 'stars', 'ads', 'twitter_follow', 'twitter_post', 'facebook_post')
);

create unique index mission_claims_twitter_follow_once_idx
  on mission_claims(user_id, mission_key)
  where mission_key = 'twitter_follow';

-- Waktu mulai aksi ditulis server sebelum user meninggalkan Mini App. Klaim sosial wajib
-- menunggu sepuluh detik dari cap waktu ini, jadi memanipulasi countdown di klien tidak
-- cukup untuk menerima energi. Satu baris per hari membuat start idempotent: mengetuk link
-- lagi tidak mereset hitung mundur yang sudah berjalan.
create table social_mission_attempts (
  user_id bigint not null references users(id) on delete cascade,
  quota_date date not null,
  mission_key text not null,
  started_at timestamptz not null default now(),
  primary key (user_id, quota_date, mission_key),
  constraint social_mission_attempts_known_key check (
    mission_key in ('twitter_follow', 'twitter_post', 'facebook_post')
  )
);
create index social_mission_attempts_user_date_idx
  on social_mission_attempts(user_id, quota_date);

-- Satu besaran reward untuk ketiga aksi menjaga panel tetap ringkas. Nilainya diturunkan
-- relatif terhadap kapasitas energi yang sedang berlaku agar migrasi aman pada config yang
-- sudah pernah diubah admin.
update economy_config
set config = config || jsonb_build_object(
  'missionSocialReward', least(
    coalesce((config ->> 'missionSocialReward')::int, 1),
    (config ->> 'maxEnergy')::int
  )
)
where id = 1;
