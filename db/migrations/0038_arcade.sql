-- Arena: dua permainan yang hadiahnya energi atau isi stok reward, tidak pernah credit. | Hadiah energi berbiaya nol — kolam reward tetap mematok berapa credit yang bisa keluar, | jadi energi cuma mempercepat user mencapai plafonnya lewat lebih banyak task. Hadiah isi | stok BERBIAYA: ia menaikkan plafon itu sendiri. Ditukar sadar dengan impresi iklan | berhadiah yang mengunci tiap kali main (`arcadeAdGated`), dan dijaga tiga plafon dari | panel: jatah harian, cooldown, dan bobot undian. | Baris ini yang menegakkan jatah dan cooldown, bukan pengecekan `if` di aplikasi. Bentuknya | mengikuti `ad_views` (migrasi 0024): satu indeks unik parsial untuk "satu main terbuka per | user", satu lagi untuk "satu pass iklan tidak pernah membayar dua kali main". | Migrasi ini WAJIB menyertai deploy kodenya: `validateEconomyConfig` juga jalan saat membaca | baris `economy_config`, dan key baru yang belum ada membuat seluruh API menolak permintaan.

create table arcade_plays (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  -- Tanggal WIB, diisi aplikasi lewat ekspresi yang sama dengan seluruh konsep "hari" di | repo ini. Bukan `default now()`, supaya batas harinya datang dari satu tempat.
  quota_date date not null,
  game text not null,
  -- open: main sudah dibuka dan ongkosnya sudah dibayar, hasilnya belum disetel. | settled: undian sudah digulirkan dan hadiahnya sudah diberikan. | expired: dibuka lalu ditinggal sampai lewat umurnya.
  state text not null default 'open',
  -- Pass iklan yang membayar main ini. Null saat `arcadeAdGated` dimatikan dari panel.
  ad_view_id uuid references ad_views(id),
  -- Kotak yang dipilih user, 0..2. Hanya untuk permainan kotak, dan hanya sebagai jejak: | undiannya digulirkan server, pilihan user memilih SALAH SATU dari tiga hasil yang | sudah digulirkan, jadi kolom ini tidak pernah ikut menentukan besaran hadiah.
  pick smallint,
  -- Yang benar-benar diberikan saat itu, bukan yang berlaku di panel hari ini. Alasannya | sama dengan `mission_claims.energy_granted` di migrasi 0031: baris lama harus tetap | menceritakan apa yang sungguh terjadi.
  prize_kind text,
  prize_amount smallint not null default 0,
  opened_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint arcade_plays_known_game check (game in ('boxes', 'match')),
  constraint arcade_plays_known_state check (state in ('open', 'settled', 'expired')),
  constraint arcade_plays_known_prize
    check (prize_kind is null or prize_kind in ('pool', 'energy', 'blank')),
  constraint arcade_plays_pick_range check (pick is null or pick between 0 and 2),
  constraint arcade_plays_prize_amount_range check (prize_amount >= 0),
  -- Kesetaraan, bukan implikasi satu arah: main yang sudah disetel WAJIB punya hadiah | (termasuk 'blank' yang berarti zonk), dan main yang belum disetel tidak boleh punya. | Tanpa bentuk ini, hadiah bisa tercatat di baris yang tidak pernah ditutup.
  constraint arcade_plays_settled_shape
    check ((state = 'settled') = (prize_kind is not null and settled_at is not null)),
  -- Zonk selalu nol, hadiah tidak pernah nol. Menjaga `prize_amount` tetap bisa dibaca | apa adanya tanpa mengecek `prize_kind` lebih dulu.
  constraint arcade_plays_blank_is_zero
    check (prize_kind is distinct from 'blank' or prize_amount = 0),
  constraint arcade_plays_prize_needs_amount
    check (prize_kind is null or prize_kind = 'blank' or prize_amount > 0)
);

-- Satu main terbuka per user. Ini yang menghentikan dua tap beruntun membuka dua main | yang masing-masing membakar satu pass, bukan balapan antar-request di aplikasi.
create unique index arcade_plays_one_open on arcade_plays(user_id) where state = 'open';

-- Satu pass iklan membayar tepat satu kali main. Bentuknya sama dengan | `challenges_ad_view_unique`, dan penyempitannya juga sama alasannya: ronde yang | ditinggal MENGEMBALIKAN passnya (`expireStalePlays`), dan pass yang dihidupkan lagi | harus boleh membayar ronde berikutnya. Tanpa `state <> 'expired'`, pengembalian itu | jadi pemberian kosong — passnya kembali ke 'ready' tapi setiap upaya memakainya | ditolak indeks ini, jadi user memegang tiket yang tidak bisa dipakai apa pun. | Barisnya sendiri tetap ada dan tetap terhitung di jatah harian, jadi meninggalkan | ronde berulang kali tidak menambah satu tayangan pun.
create unique index arcade_plays_ad_view_unique on arcade_plays(ad_view_id)
  where ad_view_id is not null and state <> 'expired';

-- Jatah harian dibaca per user per tanggal WIB pada setiap pembukaan main.
create index arcade_plays_user_date_idx on arcade_plays(user_id, quota_date);

-- Penggabungan dari kiri: nilai yang mungkin sudah ada tidak ditimpa, dan key yang belum | ada diisi bawaannya. `arcadeEnabled: 0` disengaja — Arena satu-satunya fitur yang bisa | menaikkan plafon payout, jadi ia menyala lewat keputusan di panel, bukan lewat deploy.
update economy_config
set config = jsonb_build_object(
  'arcadeEnabled', 0,
  'arcadeAdGated', 1,
  'arcadeMaxPlaysPerDay', 3,
  'arcadeCooldownSeconds', 300,
  'arcadeMatchSeconds', 30,
  'arcadePoolPrizeCredits', 5,
  'arcadePoolPrizeWeight', 1,
  'arcadeEnergyPrizeAmount', 1,
  'arcadeEnergyPrizeWeight', 2,
  'arcadeBlankWeight', 1
) || config
where id = 1;
