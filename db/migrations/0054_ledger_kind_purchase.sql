-- Jenis ledger baru untuk belanja di Toko TD.
--
-- BERDIRI SENDIRI, dan itu keharusan Postgres, bukan selera. `scripts/migrate.ts` membungkus tiap
-- berkas migrasi dalam satu transaksi, dan nilai enum yang baru ditambahkan TIDAK BOLEH dipakai di
-- transaksi yang sama dengan yang menambahkannya. Constraint `credit_ledger_amount_sign` yang
-- menyebut 'purchase' karena itu menunggu berkas berikutnya; digabung di sini, migrasinya gagal
-- dengan "unsafe use of new value of enum type".
alter type ledger_kind add value if not exists 'purchase';
