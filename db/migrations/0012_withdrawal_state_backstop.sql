-- Invarian temporal untuk `withdrawals`: yang dijaga bukan bentuk barisnya, tapi | perpindahannya. | Skema ini menegakkan invarian struktural dengan sangat baik — `hold_ledger_id | not null references credit_ledger(id)` membuat penarikan tanpa penahanan saldo | mustahil. Yang tidak dijaganya sama sekali adalah *perubahan state*. Satu-satunya | yang mencegah `paid -> rejected` dan `rejected -> paid` adalah satu `if` di | TypeScript (`settlePayout`), dan `withdrawals_state_consistent` hanya memeriksa | bentuk baris — bahkan meloloskan baris `paid` yang `rejected_at`-nya terisi. | Hari ini route admin adalah satu-satunya penulis dan guard-nya benar. Yang | dijaga di sini adalah perubahan berikutnya: skrip koreksi manual, endpoint | pembatalan, atau job rekonsiliasi yang menjalankan satu `update withdrawals set | state=...` akan diterima database tanpa keberatan. Kalau itu terjadi, | `rejected -> paid` berarti user sudah menerima refund **dan** menerima transfer | (net +c dari udara), sementara `paid -> rejected` menulis refund untuk uang yang | sudah keluar. Keduanya uang yang diciptakan, dan keduanya tidak akan berbunyi.

-- 1. Perketat bentuk barisnya: state final harus menutup pasangannya. | Drop lalu add, bukan `not valid`: kalau ada baris produksi yang sudah melanggar, | migrasi ini harus gagal keras dan berisik, bukan menyimpan pelanggaran itu di | bawah constraint yang tidak pernah divalidasi.
alter table withdrawals drop constraint withdrawals_state_consistent;
alter table withdrawals add constraint withdrawals_state_consistent check (
  (state = 'processing' and paid_at is null and rejected_at is null) or
  (state = 'paid' and paid_at is not null and rejected_at is null) or
  (state = 'rejected' and rejected_at is not null and paid_at is null)
);

-- 2. Transisi yang sah hanya dua, dan keduanya berangkat dari `processing`. | `for each row` pada `update` saja: `insert` tidak lewat sini karena state awal | sudah dijaga default kolom + constraint di atas, dan `delete` memang tidak | pernah dilakukan kode mana pun (baris penarikan adalah catatan, bukan draf). | Perbandingan `is distinct from` supaya update yang tidak menyentuh `state` | (mis. mengisi `admin_note`) lewat tanpa diperiksa.
create function withdrawals_guard_transition() returns trigger as $$
begin
  if old.state is distinct from new.state
     and not (old.state = 'processing' and new.state in ('paid', 'rejected')) then
    raise exception 'transisi withdrawal %  ->  % tidak diizinkan; koreksi lewat ledger adjustment, bukan mengedit baris lama', old.state, new.state;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger withdrawals_no_illegal_transition
  before update on withdrawals
  for each row execute function withdrawals_guard_transition();
