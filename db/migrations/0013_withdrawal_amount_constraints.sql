-- Constraint nominal penarikan berhenti menduplikasi aturan ekonomi.
--
-- `check (credits >= 100)` dan `check (amount_idr = credits * 100)` menuliskan
-- ulang dua angka yang `domain/economy.ts` klaim sebagai satu-satunya sumber:
-- `WITHDRAWAL_MINIMUM_CREDITS` dan `CREDIT_VALUE_IDR`. Header file itu secara
-- eksplisit mengundang penyetelan — "Ubah CREDIT_VALUE_IDR di sini dan seluruh
-- tampilan ikut menyesuaikan" — dan menuruti kalimat itu, mis. ke 200, membuat
-- **setiap** `insert into withdrawals` gagal dengan `23514`. Fitur penarikan mati
-- total pada hari nilai tukar disetel, dan sebabnya berada di berkas yang tidak
-- disebut oleh kalimat yang mengundangnya.
--
-- Yang ditinggalkan di database adalah hal-hal yang tidak akan pernah berubah
-- ketika nilai tukar berubah: nominal harus positif, dan tidak boleh absurd.
-- Aturan ekonominya sendiri — minimum, maksimum, dan relasi credit↔rupiah — tetap
-- ditegakkan `createPayout` lewat konstanta di `domain/economy.ts`, di mana
-- keduanya bisa dibaca bersama.

-- Nama keduanya dihasilkan Postgres, bukan ditulis di migrasi 0005:
-- `check (credits >= 100)` menempel pada satu kolom sehingga menjadi
-- `withdrawals_credits_check`, sedangkan `check (amount_idr = credits * 100)`
-- menyebut **dua** kolom sehingga Postgres memperlakukannya sebagai constraint
-- tabel dan menamainya `withdrawals_check` — bukan `withdrawals_amount_idr_check`
-- seperti yang diduga dari bentuk penulisannya. Diverifikasi lewat `pg_constraint`.
--
-- Tanpa `if exists`: nama yang tidak cocok harus menggagalkan migrasi supaya
-- constraint lamanya tidak diam-diam tertinggal aktif.
alter table withdrawals drop constraint withdrawals_credits_check;
alter table withdrawals drop constraint withdrawals_check;

alter table withdrawals
  -- Positif, bukan ">= 100": minimumnya aturan produk dan sudah diperiksa dua kali
  -- di aplikasi (`validateWithdrawalDraft` lalu `credits < WITHDRAWAL_MINIMUM_CREDITS`).
  add constraint withdrawals_credits_positive check (credits > 0),
  add constraint withdrawals_amount_positive check (amount_idr > 0),
  /**
   * Lantai kewarasan, bukan batas produk.
   *
   * `MAX_PAYOUT_CREDITS` (20 juta credit) hidup di `domain/economy.ts` dan
   * ditegakkan `createPayout`; angka di bawah sengaja jauh lebih longgar supaya ia
   * tidak ikut basi ketika batas produk disetel. Yang dijaganya hanyalah hal yang
   * selalu salah: nominal yang begitu besar sampai `amount_idr` mendekati batas
   * tipe kolomnya. Satu `insert into withdrawals` dari kode baru yang melewatkan
   * validasi aplikasi berhenti di sini alih-alih menjadi baris yang mustahil.
   */
  add constraint withdrawals_credits_sane check (credits <= 100000000);
