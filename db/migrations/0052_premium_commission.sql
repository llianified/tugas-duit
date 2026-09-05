-- Premium dapat laju komisi referral dan plafon komisi hariannya sendiri.
--
-- Manfaat premium sebelumnya semuanya berbentuk KAPASITAS dan KECEPATAN: energi lebih banyak,
-- stok reward lebih besar, batas soal harian lebih tinggi, jeda penarikan lebih pendek. Tidak
-- satu pun menambah rupiah yang bisa dihasilkan — semuanya cuma mempercepat sampainya user ke
-- plafon yang sama. Komisi referral adalah manfaat pertama yang benar-benar menambah penghasilan,
-- dan itu yang membuat premium punya alasan ekonomi, bukan cuma alasan kenyamanan.
--
-- Yang menahan biayanya tetap plafon harian. Karena itu keduanya harus naik bersama: menaikkan
-- persennya saja tidak menambah apa pun bagi upline yang sudah mentok plafon, dan justru bentuk
-- kekecewaan yang paling mahal — manfaat yang tertulis di kartu tapi tidak pernah terasa.
--
-- Angkanya 15% (dari 10%) dan Rp12.000/hari (dari Rp6.000). Plafonnya digandakan, bukan dinaikkan
-- sekadarnya: pada 15% seorang upline butuh sekitar Rp80.000 reward downline per hari untuk
-- menyentuhnya, dan itu sudah menuntut beberapa downline yang benar-benar aktif setiap hari.
-- Liabilitas maksimum per akun premium karena itu Rp12.000/hari, di atas harga premium sebulan —
-- jadi angka ini setelan yang harus ditinjau bersama harga, bukan angka yang aman selamanya.
-- `coalesce` menjaga migrasi ini tetap aman diulang: baris yang sudah punya key-nya tidak direset
-- ke bawaan, jadi setelan panel yang lebih dulu diubah tidak hilang.
update economy_config
set config = config || jsonb_build_object(
  'premiumReferralCommissionPercent',
    coalesce((config ->> 'premiumReferralCommissionPercent')::int, 15),
  'premiumDailyCommissionCapIdr',
    coalesce((config ->> 'premiumDailyCommissionCapIdr')::int, 12000)
)
where id = 1;
