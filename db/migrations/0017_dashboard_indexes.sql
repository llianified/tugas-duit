-- Index pendukung dashboard admin.
--
-- Seluruh index waktu yang sudah ada berbentuk `(user_id, waktu desc)` — dibuat
-- untuk pertanyaan "riwayat milik satu user", yang memang yang paling sering
-- ditanyakan aplikasi. Dashboard menanyakan hal yang berbeda: "berapa banyak
-- **siapa pun** dalam 30 hari terakhir". Kolom pertama index itu `user_id`, jadi
-- rentang waktu tanpa user tertentu tidak bisa memakainya dan berakhir sebagai
-- seq scan atas seluruh tabel.
--
-- Sekarang tabelnya kecil dan seq scan tidak terasa. Dipasang justru karena itu:
-- dashboard dibuka berulang kali oleh admin, dan tabel yang paling cepat tumbuh
-- di aplikasi ini (`credit_ledger`, `task_completions`) adalah yang dipindainya.
-- Menambahkan index setelah scan-nya terasa berarti menambahkannya pada tabel
-- yang sudah besar.
--
-- Hanya index — tidak ada constraint, tidak ada perubahan data, tidak ada
-- perubahan perilaku.
create index task_completions_completed_idx on task_completions(completed_at desc);
create index credit_ledger_created_idx on credit_ledger(created_at desc);
create index users_created_idx on users(created_at desc);
create index sessions_last_seen_idx on sessions(last_seen_at desc);
