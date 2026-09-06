-- Misi join channel WhatsApp menggantikan tiga misi X.
--
-- Arah yang sama dengan 0053: audiens app ini bapak-bapak dan emak-emak yang membuka Telegram buat
-- nambah penghasilan, dan mereka nyaris tidak ada di X. 0053 sudah memindahkan berat susunannya ke
-- WhatsApp dan TikTok sambil membiarkan misi X berjalan; migrasi ini menutup sisanya. Yang masuk
-- join channel, bukan bagikan: channel WhatsApp punya tautan undangan yang mendarat langsung di
-- layar join, jadi langkahnya bisa diantar tombol sampai selesai — syarat yang sama yang membuat
-- 0053 memilih follow TikTok dan menolak misi bikin video.
--
-- Kunci X TIDAK dicabut dari constraint, dan itu keputusan, bukan kelalaian. `mission_claims`
-- menyimpan klaim yang energinya SUDAH diberikan, dan `add constraint` memvalidasi seluruh baris
-- yang ada: mencabut 'twitter_follow' dan kawan-kawannya akan menggagalkan migrasi ini di produksi
-- — dan karena migrasi jalan sebelum `next build`, itu menghentikan seluruh deploy. Menghapus
-- barisnya lebih buruk lagi: ia menghapus jejak energi yang benar-benar keluar. Yang menghentikan
-- penerbitan misinya adalah katalog di `domain/progression/missions.ts`, dan `isMissionKey()`
-- menolak kunci itu di pintu API. Constraint di sini tugasnya menangkap salah ketik pada tulisan
-- BARU, bukan menulis ulang masa lalu.
alter table mission_claims drop constraint mission_claims_known_key;
alter table mission_claims add constraint mission_claims_known_key check (
  mission_key in (
    'tasks',
    'stars',
    'ads',
    'hard',
    'arcade',
    'variety',
    -- Pensiun sejak migrasi ini; tetap sah supaya klaim lama tidak menjadi ilegal surut.
    'twitter_follow',
    'twitter_post',
    'twitter_like_repost',
    'facebook_post',
    'whatsapp_share',
    'whatsapp_channel',
    'tiktok_follow'
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
    'tiktok_follow'
  )
);

-- Sekali seumur akun, jadi indeksnya yang menegakkan — bukan `quota_date` seperti misi harian.
-- Tanpa baris ini satu akun bisa menyimpan satu klaim join per hari WIB, dan energinya keluar
-- berulang dari aksi yang cuma dikerjakan sekali. Bentuknya sama persis dengan
-- `mission_claims_tiktok_follow_once_idx` di 0053.
create unique index mission_claims_whatsapp_channel_once_idx
  on mission_claims(user_id, mission_key)
  where mission_key = 'whatsapp_channel';

-- Besarannya diturunkan dari misi yang iramanya sama — follow TikTok, sekali per akun — bukan
-- dipatok di sini: menambah misi tidak boleh menyelundupkan besaran ekonomi baru ke baris produksi.
-- Dijepit kapasitas energi karena `claimMission` menolak hadiah yang tidak muat utuh, jadi misi
-- yang hadiahnya kelebihan tidak akan pernah bisa diambil siapa pun dan gagalnya diam.
--
-- `coalesce` membaca key-nya sendiri lebih dulu supaya migrasi ini aman dijalankan ulang di atas
-- baris yang sudah pernah disetel admin.
--
-- Tiga key reward X yang pensiun ikut DIBUANG dari barisnya. Membiarkannya terlihat lebih aman —
-- `validateEconomyConfig` cuma menelusuri `ECONOMY_FIELDS` dan mengabaikan key asing — tapi repo
-- ini memegang invarian yang lebih ketat: baris hasil migrasi harus sama PERSIS dengan
-- `DEFAULT_ECONOMY_CONFIG`, dan itu dikunci `ECON` di `server/economy/economy-config.test.ts`.
-- Menyisakan key pensiun membuat baris seed dan bawaan kode menyimpang, dan penjaga itulah satu-
-- satunya yang menangkap migrasi yang lupa menyeimbangkan config.
--
-- Jendela antara migrasi ini jalan dan kode barunya live ditanggung `fillMissing`: kode lama masih
-- menuntut ketiga key itu, tidak menemukannya, lalu memakai nilai bawaan sambil menulis peringatan.
-- Persis keadaan yang toleransi itu dibuat untuk menanganinya, dan tidak ada permintaan yang gagal.
update economy_config
set config = (config - 'missionTwitterFollowReward'
                     - 'missionTwitterLikeRepostReward'
                     - 'missionTwitterPostReward') || jsonb_build_object(
  'missionWhatsappChannelReward', least(
    coalesce(
      (config ->> 'missionWhatsappChannelReward')::int,
      (config ->> 'missionTiktokFollowReward')::int,
      1
    ),
    coalesce((config ->> 'maxEnergy')::int, 5)
  )
)
where id = 1;
