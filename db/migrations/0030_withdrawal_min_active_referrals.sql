-- Syarat "referral aktif minimum" pindah dari konstanta kode ke panel admin.
--
-- Angkanya selama ini hidup sebagai `REQUIRED_ACTIVE_REFERRALS = 5` di
-- `server/payout-rules.ts`, satu-satunya syarat penarikan yang tidak bisa disetel
-- tanpa deploy — padahal ia yang paling menentukan siapa yang boleh menarik sama
-- sekali. User yang jujur tapi tidak punya teman untuk diajak terkunci permanen,
-- dan tidak ada cara mengujinya selain mengubah kode.
--
-- Nilai yang dipasang di sini SAMA dengan konstanta lama, jadi migrasi ini tidak
-- mengubah perilaku produksi. Yang berubah cuma tempat menyetelnya.
--
-- Urutan `||` seperti migrasi sebelumnya: objek default di kiri, `config` di kanan,
-- supaya baris yang sudah disetel admin tidak tertimpa.
update economy_config
set config = jsonb_build_object('withdrawalMinActiveReferrals', 5) || config
where id = 1;
