-- Memindahkan besaran pengerjaan task dari kode ke panel admin. | Sampai sekarang percobaan per soal, batas waktu pengerjaan, batas 2 bintang, | dan bentuk soal per tingkat kesulitan hidup sebagai konstanta di | `server/challenge.ts`, `domain/stars.ts`, dan `features/captcha/domain.ts`. | Semuanya menggeser laju penghasilan, jadi semuanya seharusnya bisa disetel | tanpa deploy — sama seperti besaran ekonomi lain. | Migrasi ini **wajib** menyertai deploy kodenya, bukan menyusul. | `validateEconomyConfig` dijalankan juga saat **membaca** baris ini, dan ia | menuntut setiap field yang terdaftar di `ECONOMY_FIELDS` ada. Baris tanpa key | baru akan membuat `loadEconomyConfig` melempar `ECONOMY_CONFIG_INVALID` dan | server menolak melayani seluruh permintaan, bukan hanya panel admin. | Urutan `||` disengaja: objek default di kiri, `config` di kanan. Key yang sudah | ada di baris menang, key baru terisi nilainya. Menukar urutannya akan menimpa | setelan admin dengan bawaan setiap kali migrasi ini jalan. | Nilainya sama persis dengan konstanta yang digantikannya, dan harus sama | dengan `DEFAULT_ECONOMY_CONFIG` — `server/economy-config.test.ts` | membandingkan keduanya supaya tidak bisa menyimpang diam-diam. Menyalakan | setelan ini tidak menggeser satu pun perilaku yang berjalan hari ini.
update economy_config
set config = jsonb_build_object(
  'maxAttemptsPerTask', 3,
  'taskWindowSeconds', 300,
  'star2ParMultiplier', 2,
  'textLengthEasy', 4,
  'textLengthMedium', 5,
  'textLengthHard', 6,
  'mathDigitsEasy', 2,
  'mathDigitsMedium', 2,
  'mathDigitsHard', 3,
  'mathCeilingEasy', 30,
  'mathCeilingMedium', 99,
  'mathCeilingHard', 400,
  'selectOptionsEasy', 4,
  'selectOptionsMedium', 6,
  'selectOptionsHard', 9
) || config
where id = 1;
