-- Dua kolom profil Telegram yang ditulis ulang setiap login tapi tidak pernah
-- dibaca — lanjutan langsung dari audit yang sama yang membuang `is_premium` di
-- migrasi 0007, dengan alasan yang tidak berubah: menyimpan atribut akun orang
-- tanpa ada yang memakainya berarti menanggung datanya tanpa imbalan, dan
-- membuat pembaca berikutnya mengira ada fitur yang bergantung padanya.
--
-- `last_name` tidak pernah muncul di layar mana pun; seluruh aplikasi memakai
-- `first_name`. `language_code` tidak pernah dibaca karena bahasa UI-nya tunggal
-- (Indonesia) dan tidak ada jalur pemilihan bahasa.
--
-- Penulisannya dihapus dari `app/api/auth/telegram/route.ts` dalam perubahan yang
-- sama, jadi migrasi ini dijalankan bersama deploy kode itu — bukan mendahuluinya.
--
-- Seperti 0007: keduanya datang dari `initData` pada setiap login, jadi
-- menghidupkannya kembali cukup satu `add column` dan tidak ada data historis
-- yang hilang di sini.
alter table users drop column if exists last_name;
alter table users drop column if exists language_code;
