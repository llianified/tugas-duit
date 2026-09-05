-- Dua tipe soal baru: Urutkan Angka dan Hitung Bentuk.
--
-- Varian di migrasi sebelumnya menambah ATURAN main tanpa mengubah cara menjawabnya — tetap
-- mengetik, menghitung, atau memilih satu petak. Dua tipe ini yang pertama menambah bentuk
-- interaksinya sendiri: Urutkan Angka menjadikan papannya sekaligus alat jawab lewat urutan
-- ketukan, dan Hitung Bentuk memisahkan yang ditonton dari yang diketik.
--
-- `alter type ... add value` bersifat aditif dan aman dijalankan sebelum kode barunya live: baris
-- `challenges` lama tidak tersentuh, dan nilai baru belum dipakai siapa pun sampai deploy-nya
-- selesai. Yang TIDAK boleh adalah memakai nilai baru di transaksi yang sama dengan yang
-- menambahkannya — Postgres menolak itu — jadi migrasi ini sengaja hanya menambah, tanpa satu pun
-- insert atau update yang menyebut 'order' maupun 'count'.
--
-- Nilai enum tidak bisa dihapus lagi setelah ditambahkan. Kalau salah satu tipe perlu dimatikan,
-- caranya mencoretnya dari `CAPTCHA_TYPES` di domain, bukan mengembalikan migrasi ini.
alter type captcha_type add value if not exists 'order';
alter type captcha_type add value if not exists 'count';
