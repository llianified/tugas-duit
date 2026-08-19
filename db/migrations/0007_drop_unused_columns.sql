-- Membuang dua struktur yang tidak punya satu pun pembaca di kode (audit S2 & S3).
--
-- Kolom dan tabel tanpa pemakai bukan sekadar berantakan: ia membuat pembaca
-- berikutnya mengira ada kode yang bergantung padanya, lalu menjaga sesuatu yang
-- tidak menjaga apa pun.

-- `referral_clicks` tidak pernah di-insert maupun di-select. Kolom `ip_hash`-nya
-- menandakan rencana melacak klik link referral yang tidak selesai dikerjakan —
-- dan begitu ia mulai diisi, aplikasi menyimpan data pribadi (IP, walau di-hash)
-- beserta kewajiban retensinya. Dihapus sekarang, bukan diwarisi.
-- Kalau pelacakan klik nanti benar-benar dibutuhkan, tabelnya dibuat ulang bersama
-- kode yang mengisinya dan kebijakan retensi yang eksplisit, dalam satu perubahan.
drop index if exists referral_clicks_code_idx;
drop table if exists referral_clicks;

-- `is_premium` ditulis ulang setiap login dari `initData`, tapi tidak pernah dibaca:
-- tidak ada tarif, kuota, maupun tampilan yang membedakan user premium. Menyimpan
-- atribut akun Telegram yang tidak dipakai berarti menanggung datanya tanpa imbalan.
-- Penulisannya dihapus dari `app/api/auth/telegram/route.ts` dalam perubahan yang sama.
--
-- Catatan untuk masa depan: `initData` selalu membawa nilai ini, jadi menghidupkannya
-- kembali cukup satu `add column` — tidak ada data historis yang hilang di sini.
alter table users drop column if exists is_premium;
