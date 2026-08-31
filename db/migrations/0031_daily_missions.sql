-- Misi harian.
--
-- Yang disimpan HANYA klaimnya. Kemajuan ketiga misi dihitung ulang dari tabel yang
-- sudah ada — `task_completions` untuk jumlah task dan bintang tiga, `ad_views` untuk
-- tayangan iklan yang benar-benar selesai. Menyimpan penghitung terpisah berarti dua
-- sumber kebenaran untuk hal yang sama, dan keduanya pasti berselisih suatu saat:
-- satu task yang gagal ditulis di salah satunya membuat misi terasa curang selamanya.
--
-- Kunci utamanya gabungan (user, tanggal, misi) — itu yang menegakkan "sekali per hari
-- per misi", bukan pengecekan `if` di aplikasi. Klaim ganda dari dua tap beruntun
-- berhenti di database, bukan di balapan antar-request.
--
-- `quota_date` memakai tanggal WIB, sama seperti `daily_quotas` dan seluruh konsep
-- "hari" di repo ini. Kolomnya diisi aplikasi, bukan `default`, supaya batas harinya
-- datang dari satu ekspresi yang sama di semua tempat.
create table mission_claims (
  user_id bigint not null references users(id) on delete cascade,
  quota_date date not null,
  mission_key text not null,
  -- Energi yang benar-benar diberikan saat itu, bukan yang dijanjikan definisinya.
  -- Besaran hadiah bisa berubah di kode; baris lama harus tetap menceritakan apa yang
  -- sungguh terjadi, bukan apa yang berlaku hari ini.
  energy_granted smallint not null check (energy_granted > 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id, quota_date, mission_key),
  constraint mission_claims_known_key check (mission_key in ('tasks', 'stars', 'ads'))
);

create index mission_claims_user_date_idx on mission_claims(user_id, quota_date);
