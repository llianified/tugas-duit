-- Verifikasi server-ke-server untuk tiket iklan berhadiah. | Sampai migrasi ini, satu-satunya bukti "iklan sudah ditonton" adalah Promise | `show_<zone>()` yang resolve di perangkat user. Bukti itu tidak pernah menyentuh | server Monetag, jadi ia bisa dipalsukan dari dua arah: menekan iklan lalu menekan | back (SDK tetap resolve), dan memanggil `POST /api/ads/claim` langsung dengan | ticketId yang sah tanpa satu pun iklan tayang. Postback menutup keduanya karena ia | datang dari Monetag ke server kita, di luar jangkauan klien. | `ymid` yang dikirim `rewardedShowParams()` sudah berisi `ad_views.id`, jadi | pencocokannya tidak butuh tabel pemetaan baru — kolom di bawah cukup. | `verify_price` disimpan bukan untuk akuntansi melainkan untuk satu pertanyaan yang | sering ditanyakan setelah fitur ini menyala: apakah hadiah yang dibayarkan sepadan | dengan pendapatan yang benar-benar masuk. Tanpa angkanya, jawabannya cuma tebakan. | `adsPostbackRequired` sengaja dipasang 0. Menyalakannya lewat migrasi berarti | seluruh tiket iklan berhenti keluar kalau URL postback belum diisi di dashboard | Monetag atau secret-nya salah — dan yang terlihat user cuma tombol iklan yang tidak | pernah berhasil. Urutan yang benar: deploy, tunggu `verified_at` mulai terisi, baru | nyalakan dari panel admin. Postback tetap diterima dan dicatat selama gerbangnya | mati, jadi masa tunggu itu memang bisa dipakai membuktikan.

alter table ad_views add column verified_at timestamptz;
alter table ad_views add column verify_event text;
alter table ad_views add column verify_price numeric(12,6);

-- Bentuknya dijaga di sini, bukan di aplikasi: baris berverifikasi tanpa jenis event | adalah jejak yang tidak bisa dibaca lagi setelah kejadiannya lewat.
alter table ad_views add constraint ad_views_verify_shape
  check (verified_at is null or verify_event in ('impression','click'));

-- Menemukan tayangan yang dikonfirmasi tapi tiketnya sudah telanjur hangus. Itu gejala | postback yang datang lebih lambat daripada `adsTicketTtlSeconds`, dan satu-satunya cara | melihatnya adalah mencarinya lebih dulu.
create index ad_views_verified_idx on ad_views(verified_at desc) where verified_at is not null;

-- Urutan `||` disengaja: objek default di kiri, `config` di kanan. Key yang sudah ada di | baris menang, key baru terisi bawaannya. Menukar urutannya akan menimpa setelan admin | setiap kali migrasi ini jalan.
update economy_config
set config = jsonb_build_object('adsPostbackRequired', 0) || config
where id = 1;
