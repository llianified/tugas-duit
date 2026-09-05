-- Papan peringkat berubah dari sepanjang masa jadi musiman.
--
-- Papan sepanjang masa dikuasai akun yang paling lama ada, dan selisihnya tidak akan pernah
-- terkejar: user yang daftar minggu ini melihat sepuluh besar yang mustahil didekati, jadi
-- peringkat berhenti jadi alasan bersaing untuk hampir semua orang. Musim memberi semua orang
-- garis start yang sama setiap minggu.
--
-- Tidak ada tabel musim. Batas musim diturunkan dari tanggal dengan anchor hari Senin, sama seperti
-- undian misi harian, jadi tiap server sampai pada musim yang sama tanpa satu baris pun disimpan.
-- Konsekuensinya harus diketahui: riwayat peringkat musim lalu TIDAK tersimpan di mana pun. Kalau
-- suatu saat juara musim perlu dicatat, itu tabel baru dan migrasi tersendiri, bukan perubahan di
-- sini.
--
-- Isi 0 untuk mengembalikan papan sepanjang masa; kode membacanya sebagai "tanpa jendela".
update economy_config
set config = config || jsonb_build_object(
  'leaderboardSeasonDays', coalesce((config ->> 'leaderboardSeasonDays')::int, 7)
)
where id = 1;
