-- Pesan bot yang mengajak kembali: energi penuh, stok reward penuh, streak hampir putus,
-- saldo siap ditarik, dan ringkasan komisi/referral.
--
-- Semuanya dikirim dari cron yang sudah jalan tiap jam (`scripts/maintenance.ts`), bukan dari
-- jalur request. Dua alasannya: mengirim HTTP ke Telegram di dalam transaksi yang sedang
-- memegang `for update` pada baris `users` menahan kunci selama panggilan jaringan, dan
-- notifikasi per task berarti belasan pesan sehari untuk satu user.
--
-- Tabel ini penanda "sudah pernah dikirim", bukan antrean: barisnya ditulis pada transaksi
-- yang sama dengan pengiriman, dan `bot_notifications_once` yang mencegah pesan yang sama
-- datang dua kali. `dedupe_key` bentuknya ikut jenis pesannya — tanggal WIB untuk yang boleh
-- berulang harian, tingkat rank untuk `rank_up`, tanggal aktif terakhir untuk winback.

create table bot_notifications (
  id bigint generated always as identity primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  dedupe_key text not null,
  sent_at timestamptz not null default now()
);

create unique index bot_notifications_once on bot_notifications(user_id, kind, dedupe_key);
create index bot_notifications_sent_at_idx on bot_notifications(sent_at);

-- Opt-out lewat /stop di bot. Sengaja penanda waktu, bukan boolean: kapan user berhenti
-- adalah hal yang perlu diketahui saat ada laporan spam, dan /start mengosongkannya lagi.
--
-- Yang dimatikan cuma pesan ajakan. Notifikasi penarikan (`server/notify.ts`) tetap jalan:
-- itu kabar tentang uang yang sedang berjalan, bukan promosi, dan user yang mengajukan
-- penarikan berhak tahu hasilnya.
alter table users add column notifications_muted_at timestamptz;
