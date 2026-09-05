-- Syarat hari aktif dicabut, syarat premium menggantikannya sebagai gerbang penarikan.
--
-- Hari aktif dipilih dulu sebagai penghalang pabrik akun: umur akun tidak menuntut apa pun,
-- sedangkan tujuh hari aktif menuntut task betulan di hari-hari terpisah. Tapi pabrik akun memang
-- cuma perlu MENUNGGU — biayanya nol, sekadar waktu. Premium menuntut biaya nyata per akun, dan
-- itu penghalang yang jauh lebih mahal untuk diskalakan.
--
-- Yang hilang bersamanya adalah gerbang waktu untuk user jujur: penarikan pertama tidak lagi
-- menuntut tujuh hari kalender. Yang menahan tinggal ambang saldo dan referral aktif, keduanya
-- tetap menuntut task betulan.
--
-- Bawaannya MATI. Menyalakan gerbang berbayar di atas saldo yang sudah dihasilkan user adalah
-- keputusan yang harus diambil sadar dari panel, bukan efek samping sebuah deploy — dan pada saat
-- migrasi ini jalan sudah ada ratusan akun yang saldonya melewati ambang di bawah syarat lama.
update economy_config
set config = (config - 'withdrawalMinActiveDays') || jsonb_build_object(
  'withdrawalRequiresPremium', coalesce((config ->> 'withdrawalRequiresPremium')::int, 0)
)
where id = 1;
