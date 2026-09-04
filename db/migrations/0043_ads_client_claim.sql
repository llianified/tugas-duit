-- Bukti penyelesaian dari klien dipisahkan dari bukti pembayaran Monetag. |
-- `client_claimed_at` hanya ditulis oleh server setelah Promise SDK selesai dan klaim |
-- pertama lolos `adsMinWatchSeconds`; waktu perangkat tidak pernah dipercaya. Saat |
-- `adsPostbackRequired` aktif, tiket menjadi pass hanya jika kolom ini DAN `verified_at` |
-- sudah terisi. Pemisahan ini menutup dua celah: postback yang datang segera setelah |
-- iklan dibuka tidak bisa menerbitkan pass sendirian, dan klaim cepat yang ditolak tidak |
-- bisa diloloskan dengan menunggu lalu mencoba ticketId yang sama lagi.

alter table ad_views add column client_claimed_at timestamptz;

-- Nilai hanya boleh muncul setelah tiket dibuat. Constraint database menjaga jejak audit |
-- tetap masuk akal meskipun suatu hari ada jalur penulis baru di luar `claimAdTicket`.
alter table ad_views add constraint ad_views_client_claim_time
  check (client_claimed_at is null or client_claimed_at >= created_at);
