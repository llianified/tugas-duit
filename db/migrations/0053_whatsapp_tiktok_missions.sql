-- Dua misi sosial baru di platform yang audiens app ini benar-benar pakai.
--
-- Susunan sebelumnya menaruh tiga dari empat misi sosial di X, padahal yang memakai app ini
-- bapak-bapak dan emak-emak yang membuka Telegram buat nambah penghasilan — dan mereka nyaris
-- tidak ada di sana. WhatsApp adalah tempat demografi itu benar-benar hidup, dan TikTok yang
-- kedua. Facebook tetap, karena ia satu-satunya dari susunan lama yang memang mereka pakai.
--
-- Yang dibagikan ke WhatsApp adalah pesan ke kontak atau grup, BUKAN Status: tidak ada tautan
-- yang membuka komposer Status di semua perangkat, jadi misi yang menyuruh "pasang di Status"
-- menjanjikan langkah yang tombolnya sendiri tidak bisa antar. TikTok hanya follow karena
-- platformnya tidak menyediakan tautan yang mengisi komposer video, dan misi membuat konten
-- menuntut peninjauan manual yang belum ada tempatnya di panel.
--
-- Migrasi ini ADITIF. Kunci X lama tetap sah supaya klaim yang sudah tersimpan tidak menjadi
-- ilegal surut, dan supaya deploy yang masih berjalan selama jendela migrasi tidak patah.
-- Pencabutannya menyusul di deploy berikutnya, seperti 0020 dan 0021.
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
    'twitter_like_repost',
    'whatsapp_share',
    'tiktok_follow'
  )
);

alter table social_mission_attempts drop constraint social_mission_attempts_known_key;
alter table social_mission_attempts add constraint social_mission_attempts_known_key check (
  mission_key in (
    'twitter_follow',
    'twitter_post',
    'facebook_post',
    'twitter_like_repost',
    'whatsapp_share',
    'tiktok_follow'
  )
);

-- Follow hanya sekali seumur akun, jadi indeksnya yang menegakkan — bukan `quota_date` seperti
-- misi harian. Tanpa baris ini, satu akun bisa menyimpan satu klaim follow per hari WIB dan
-- energinya keluar berulang dari aksi yang cuma dikerjakan sekali.
create unique index mission_claims_tiktok_follow_once_idx
  on mission_claims(user_id, mission_key)
  where mission_key = 'tiktok_follow';

-- Besarannya diturunkan dari angka yang SUDAH dipilih admin untuk misi sejenis, bukan dipatok di
-- sini: bagikan-WhatsApp mengikuti post Facebook karena sama-sama sekali per hari WIB, dan follow
-- TikTok mengikuti follow X karena sama-sama sekali per akun. Menambah misi tidak boleh
-- menyelundupkan besaran ekonomi baru ke baris produksi.
--
-- Keduanya dijepit kapasitas energi dengan alasan yang sudah ditulis di 0048: `claimMission`
-- menolak hadiah yang tidak muat utuh, jadi misi yang hadiahnya kelebihan tidak akan pernah bisa
-- diambil siapa pun, dan gagalnya diam.
--
-- `coalesce` membaca key-nya sendiri lebih dulu supaya migrasi ini aman dijalankan ulang di atas
-- baris yang sudah pernah disetel admin.
update economy_config
set config = config || jsonb_build_object(
  'missionWhatsappShareReward', least(
    coalesce(
      (config ->> 'missionWhatsappShareReward')::int,
      (config ->> 'missionFacebookPostReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  ),
  'missionTiktokFollowReward', least(
    coalesce(
      (config ->> 'missionTiktokFollowReward')::int,
      (config ->> 'missionTwitterFollowReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  )
)
where id = 1;
