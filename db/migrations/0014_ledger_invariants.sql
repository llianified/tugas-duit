-- Invarian yang selama ini hanya dijaga TypeScript. | Skema ini sudah menegakkan hal-hal struktural dengan baik — `hold_ledger_id not | null references credit_ledger(id)`, trigger append-only, saldo non-negatif di | dua lapis. Yang tertinggal adalah sekumpulan aturan yang benar hari ini semata | karena satu-satunya penulisnya adalah kode aplikasi yang kebetulan benar. Satu | skrip perbaikan data, satu endpoint baru, atau satu job rekonsiliasi yang | menulis langsung akan diterima database tanpa keberatan.

-- 1. Tanda `amount` harus cocok dengan `kind`. | Tanpa ini database menerima `kind='withdrawal_hold'` dengan amount positif | (penahanan yang justru menambah saldo) atau `kind='task'` dengan amount negatif | (reward yang mengurangi). Keduanya lolos seluruh constraint yang ada sekarang | dan menghasilkan ledger yang tetap berjumlah benar tapi menceritakan hal yang | tidak pernah terjadi. | `adjustment` sengaja bebas tanda: itu justru gunanya — koreksi bisa ke dua arah.
alter table credit_ledger add constraint credit_ledger_amount_sign check (
  (kind in ('task', 'commission', 'withdrawal_refund') and amount > 0)
  or (kind = 'withdrawal_hold' and amount < 0)
  or kind = 'adjustment'
);

-- 2. `channel_id` harus salah satu tujuan yang dikenal. | Kolomnya `text` tanpa `check` maupun FK, jadi channel karangan hanya ditolak | `PAYOUT_CHANNELS.some(...)` di TypeScript. Baris dengan channel yang tidak | dikenal akan membuat `getPayoutChannel` di layar admin gagal menemukan namanya, | dan yang dibaca admin sebelum mentransfer adalah label tujuan. | Daftar nilai, bukan tabel referensi: ketiganya adalah konstanta produk yang | hidup di `features/withdraw/domain.ts`, bukan data yang dikelola siapa pun. | Menambah channel berarti satu migrasi — dan memang seharusnya begitu, karena | channel baru juga menuntut perubahan kode.
alter table withdrawals add constraint withdrawals_known_channel check (
  channel_id in ('dana', 'gopay', 'ovo')
);

-- 3. Penolakan wajib menyertakan alasannya. | Alasan penolakan adalah satu-satunya penjelasan yang diterima user ketika | uangnya tidak keluar; route admin sudah mewajibkannya, database belum. Baris | `rejected` tanpa alasan berarti notifikasi yang terkirim ke user berbunyi | kosong.
alter table withdrawals add constraint withdrawals_rejected_needs_reason check (
  state <> 'rejected' or (reject_reason is not null and length(btrim(reject_reason)) > 0)
);

-- 4. `truncate` ikut ditolak trigger append-only. | Trigger `credit_ledger_no_update` dipasang `for each row`, dan `truncate` tidak | menghasilkan baris — jadi ia melewati penjagaan append-only sepenuhnya. Tabel | yang seluruh desainnya bertumpu pada "tidak ada yang bisa menghapus ini" bisa | dikosongkan satu perintah. `for each statement` yang menangkap `truncate` | menutup jalur terakhir itu.
create trigger credit_ledger_no_truncate
  before truncate on credit_ledger
  for each statement execute function credit_ledger_append_only();
