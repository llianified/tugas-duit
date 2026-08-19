# Keputusan desain yang sering disalahsangka bug

Daftar hal yang tampak seperti cacat saat dibaca sepintas, padahal memang
disengaja. Tujuannya satu: audit berikutnya tidak perlu menemukan ulang alasan
yang sama. Setiap baris menyebut tempat aturannya ditegakkan, supaya klaim di
sini bisa dicek, bukan dipercaya.

## Ekonomi

| Yang terlihat janggal | Kenapa memang begitu | Ditegakkan di |
| --- | --- | --- |
| Komisi referral yang melewati plafon harian **hangus**, tidak ditunda ke besok | Plafonnya plafon keras — batas *penerimaan* per hari, bukan antrean. Menundanya akan menaikkan total payout jangka panjang. | `consumeCommissionQuota`; test `ECON-2 … menghanguskan sisanya` |
| Komisi referral tidak ikut menghabiskan plafon task | Komisi sudah didanai task downline yang masing-masing sudah dibatasi plafonnya sendiri. Kolom `commission_credits` sengaja terpisah dari `credits_earned`. | migrasi `0011` |
| `withdrawals.amount_idr` bisa tidak sama dengan `credits × kurs sekarang` | Kurs dibekukan saat pengajuan. Constraint `amount_idr = credits * 100` sengaja dilepas supaya kurs boleh berubah tanpa mengubah pengajuan lama. Semua tampilan rupiah penarikan membaca kolom ini, bukan menghitung ulang. | migrasi `0013`; `server/notify.ts`, `withdraw-receipt.tsx` |
| `daily_quotas.tasks_completed` tetap naik walau task tidak dibayar kolam | Kolom itu jaring anti-bot yang menghitung *submit*, bukan task berbayar. Menghitung task berbayar saja justru melonggarkan jaring untuk akun yang paling agresif menguras kolam. | `consumeQuota` |
| Penghasilan task ditahan kolam yang mengisi ulang bertahap, **bukan** plafon yang reset tengah malam | Reset harian memusatkan seluruh permintaan di satu jam dan menghukum user yang zona waktunya berbeda. Kolam memberi alasan untuk kembali tanpa tenggat. Bentuknya sengaja dikembarkan dengan energi. | `domain/reward-pool.ts`; migrasi `0023` |
| Reward yang lebih besar dari sisa kolam **dipotong**, bukan ditolak | Task yang sudah dijawab benar tetap dibayar sebagian; menolaknya menghanguskan usaha user hanya karena kolamnya kurang satu credit. | `applyRewardPoolSpend`; test `pays only what is left instead of refusing the last task` |
| Bonus rank dan streak menambah kapasitas kolam, bukan laju isi ulangnya | Kapasitas mengubah berapa yang bisa ditumpuk lalu dihabiskan dalam satu sesi, tanpa menaikkan penghasilan maksimum per hari. Menaikkan laju menggeser seluruh biaya jangka panjang. | `rewardPoolCapacity`; `domain/reward-pool.test.ts` |
| Menit yang belum genap satu interval tidak hangus saat kolam dibelanjakan | Jam acuan hanya dimajukan sebanyak interval yang benar-benar dibayar. Tanpa ini, user yang membuka app tepat sebelum interval genap kehilangan progres isi ulangnya setiap kali. | `regenAnchor` di `domain/reward-pool.ts` |
| Iklan memberi **tiket masuk task**, bukan energi atau credit | Hadiah energi hangus tanpa jejak saat energi penuh (`applyEnergyGrant` memotong di `maxEnergy()`) dan menggeser jangkar regen sehingga hitung mundur di UI melompat. Tiket disimpan sebagai barisnya sendiri, jadi tidak pernah hangus diam-diam dan niatnya terbaca di data. Yang lebih penting: tiket tidak mencetak Rupiah — bayarannya tetap lewat kolam reward dan `daily_quotas`, jadi klaim palsu hanya mempercepat user menghabiskan plafonnya sendiri. | migrasi `0024`; `docs/rencana-adsgram.md` §2 |
| Klaim iklan dipercaya apa adanya dari klien | Verifikasi server-ke-server (Reward URL) baru dibuka Adsgram di atas ±50.000 DAU. Selama di bawah itu, pengamannya bukan bukti tontonan melainkan plafon harian, cooldown, dua indeks unik parsial, dan sinyal fraud. Karena itu hadiahnya sengaja dipilih yang tidak bisa langsung ditarik jadi uang. | `server/ads.ts`; `docs/rencana-adsgram.md` §1, §6 |
| `challenges.ad_view_id` **tidak** dikosongkan saat tiketnya dikembalikan | Tiket yang dihidupkan ulang harus boleh membayar challenge berikutnya, dan itu diurus indeks `challenges_ad_view_unique` yang disempitkan ke `energy_refunded_at is null` — bukan dengan menghapus jejaknya. Mengosongkan kolomnya akan melepas satu-satunya bukti bahwa challenge itu pernah membayar ongkos masuk, dan constraint `challenges_entry_refund_needs_entry` kehilangan pijakannya. | migrasi `0024`; test `ADS-DB-3` |
| Tombol iklan tetap muncul walau energi masih penuh | Kartu task menawarkan dua cara bayar berdampingan, dan klien mengirim `payWith` secara eksplisit — server tidak pernah diam-diam memakai tiket saat user menekan tombol energi. Pass yang belum dipakai hangus lewat `adsPassTtlMinutes`, bukan diam-diam terpakai. | `startChallenge`; `features/home/active-task.tsx` |
| Tiket iklan tidak boleh dibuka selama task yang dibayarinya belum ditutup | Pass yang sudah dipakai baru bisa dihidupkan lagi kalau slot `ad_views_one_ready` kosong. Tanpa penjaga ini, user yang menonton iklan baru selagi task berbayar-tiket masih jalan membuat tiket lamanya tidak bisa dikembalikan saat task itu hangus — tiketnya hilang tanpa jejak. Menolak di depan lebih murah daripada menambah stok pass. | `adOpenRefusal` (`entry_open`); test `ADS-DB-7` |
| Membuka tiket dua kali menyerahkan tiket yang **sama**, bukan menolak | Tiket adalah izin menonton satu iklan, bukan hasil tontonan. Kalau SDK Adsgram gagal dimuat atau tayangannya batal, izin itu masih berlaku sampai `adsTicketTtlSeconds` habis; menolak permintaan berikutnya hanya mengunci user 5 menit tanpa menambah pengaman apa pun. Barisnya tetap satu, jadi `ad_views_one_pending` tidak berubah artinya. | `openAdTicket`; test `ADS-DB-8` |
| Jatah tayangan harian dihitung dari tiket yang **diklaim**, bukan yang dibuka | Plafonnya plafon hadiah. Tiket yang iklannya tidak pernah selesai tayang tidak memberi apa pun, jadi memotongnya dari jatah menghukum user atas kegagalan jaringan. Yang menahan pembukaan tiket beruntun tetap `ad_views_one_pending` plus cooldown. | `STATE_SQL` (`ready_at is not null`); test `ADS-DB-8` |
| Reward dijepit ke `challenges.max_reward`, bukan menolak pembayaran | `max_reward` adalah plafon yang dijanjikan ke user saat soalnya terbit. Kalau admin menaikkan reward selagi soal itu beredar, membayar angka baru berarti membayar di atas yang ditampilkan; melempar error berarti soalnya macet dan user terkunci sampai kedaluwarsa. Dijepit membayar tepat sebesar janjinya. | `submitAnswer`; test `ECON-5` |
| Batas task harian dan kolam kosong adalah dua penolakan berbeda | Keduanya sama-sama mengembalikan ongkos masuk, tapi obatnya berbeda: kolam terisi sendiri dalam hitungan menit, plafon harian baru lepas besok. Satu pesan untuk dua sebab membuat user menunggu sesuatu yang tidak akan datang. | `consumeQuota` (`QuotaRefusal`); `app/api/task/submit/route.ts` |
| Angka ekonomi tidak ada di kode | Semuanya dari `domain/economy-config.ts`, dipasang dari DB per request lewat `loadEconomyConfig()`. Menyetel ekonomi lewat panel admin, bukan deploy. | aturan keras #2 di `CLAUDE.md` |
| `economyConfig()` adalah state global proses | Dipasang ulang di awal setiap request oleh `loadEconomyConfig()` (cache 30 detik), jadi konsisten di dalam satu request. Nilai turunannya harus dibaca lewat fungsi, tidak boleh dibekukan ke `const` tingkat modul. | `server/economy-config.ts` |

## Angka yang sengaja tetap di kode

Seluruh besaran yang menggeser penghasilan atau pembayaran ada di panel admin —
46 field, dan `domain/economy-config.test.ts` menolak field tanpa metadata
maupun metadata tanpa field. Yang di bawah ini **bukan** kelalaian; semuanya
tetap di kode karena mengubahnya bukan menyetel ekonomi melainkan mengganti
arti data atau melanggar constraint:

| Angka | Kenapa tidak bisa disetel |
| --- | --- |
| `COMMISSION_UNITS_PER_CREDIT = 100` | Satuan, bukan besaran. Kolom `commission_units` dan `pending_units` menyimpan angka dalam satuan ini, jadi mengubahnya akan mengubah arti seluruh baris komisi yang sudah tersimpan. |
| `STAR_MAX = 3` dan tipe `StarCount` | Terikat constraint `task_completions.stars between 1 and 3`. |
| 5 tingkat rank | Terikat daftar nama rank di `features/home/progression.ts`. Ambang tiap tingkatnya sendiri bisa disetel. |
| `FLOOR_MS` di `server/fraud.ts` | Ambang sinyal anti-fraud. Ia hanya mencatat, tidak pernah mengubah reward maupun menolak pembayaran. |
| Batas retensi, ukuran halaman, rate limit, umur sesi | Operasional, bukan ekonomi. |

Satu batas datang dari database, bukan dari selera: `maxAttemptsPerTask`
maksimal 5, karena `challenges.attempts` punya `check (attempts between 0 and
5)`. Menaikkan batasnya berarti satu migrasi lebih dulu.

## Batas hari

Seluruh konsep "hari" memakai WIB dan harus sama persis dengan
`(now() at time zone 'Asia/Jakarta')::date` di SQL — streak, batas task harian,
plafon komisi referral, `daily_quotas.quota_date`, dan label waktu di UI.
Penghasilan task sendiri **tidak lagi** ikut batas hari: kolam reward memakai
jam acuan regen, bukan tanggal WIB. `formatHistoryTime` mengunci
zona waktunya sendiri; ia sengaja **tidak** memakai zona perangkat, karena user
Indonesia tersebar di tiga zona. Lihat test `formatHistoryTime` di
`shared/lib/format.test.ts` yang dijalankan di zona non-WIB.

## Penamaan

Nama rank memakai bahasa Inggris — Apprentice, Artisan, Expert, Virtuoso,
Luminary — dan itu **disengaja**, dikonfirmasi pemilik repo. Ini pengecualian
sadar terhadap aturan keras #7 di `CLAUDE.md` yang mewajibkan bahasa UI
Indonesia; pengecualiannya berhenti di nama rank saja, seluruh teks lain tetap
Indonesia. Jangan diterjemahkan balik tanpa diminta.

Glyph rank tingkat satu sengaja **bukan** segitiga. Bentuk sebelumnya —
segitiga dengan titik di tengah — terbaca sebagai piramida bermata, dan pada
14px jatuhnya mirip ikon peringatan. Diganti chevron bergaris.

## Data & skema

| Yang terlihat janggal | Kenapa memang begitu |
| --- | --- |
| `referral_commissions.settled_ledger_id` dan `withdrawals.hold_ledger_id` ditulis tapi tidak pernah dibaca aplikasi | Keduanya jejak audit uang: menghubungkan satu baris komisi/penarikan ke baris ledger yang menyelesaikannya. Dipakai saat rekonsiliasi, bukan saat melayani request. |
| `users.profile_overridden_at` hanya penanda, tidak pernah ditampilkan | Begitu admin mengoreksi nama atau username lewat panel, upsert login berhenti menimpa dua kolom itu dari `initData` untuk baris tersebut saja. Tanpa penandanya, koreksi admin hilang diam-diam pada login berikutnya. `photo_url` sengaja tidak ikut dikunci. |
| `sessions.user_agent` ditulis tapi tidak dibaca | Jejak forensik sesi. |
| `credit_ledger` tidak punya jalur update maupun delete | Append-only, ditegakkan trigger — termasuk `truncate`. | 
| Migrasi bernomor lompat (`0017` lalu `0020`) | Migrasi bersifat historis: hanya boleh ditambah, tidak pernah diedit atau dinomori ulang. |

Kolom yang **ditulis tapi tidak pernah dibaca oleh siapa pun** diperlakukan
sebaliknya — dibuang, karena menyimpan atribut akun orang tanpa pemakai berarti
menanggung datanya tanpa imbalan: `is_premium` (migrasi `0007`), lalu
`last_name` dan `language_code` (migrasi `0021`). Ketiganya datang dari
`initData` setiap login, jadi menghidupkannya kembali cukup satu `add column`
dan tidak ada data historis yang hilang.

## Kode yang terlihat mati padahal tidak

| Yang terlihat janggal | Kenapa memang begitu |
| --- | --- |
| `LEADERBOARD_ENABLED = false` sementara `features/leaderboard/*` dan `/api/leaderboard` lengkap | Fitur sengaja dimatikan, bukan ditinggalkan. Menyalakannya cukup mengubah satu konstanta. |
| `shadcn` devDependency tidak pernah diimpor dari `.ts` | Dipakai lewat `@import 'shadcn/tailwind.css'` di `app/globals.css`. |
| `export const contentType` di `app/apple-icon.tsx` tanpa pemanggil | Konvensi Next.js; frameworknya yang membacanya. |
| Ikon SVG disalin manual ke `shared/components/glyph.tsx` | Disengaja, tidak memakai library ikon. |

## Paritas yang dijaga uji, bukan kebiasaan

- `PAYOUT_CHANNELS` di `features/withdraw/domain.ts` harus sama persis dengan
  constraint `withdrawals_known_channel`. Selisih di antara keduanya berarti
  penarikan lolos TypeScript lalu ditolak database dengan `23514` — 500 di jalur
  uang. Dijaga `server/payout.test.ts` (`WD-6`), yang mencoba setiap channel dari
  daftar itu ke database sungguhan.
- Setiap key di `EconomyConfig` harus punya pembaca. `maxTasksPerDay` pernah
  tidak punya, dan panel admin diam-diam tidak berpengaruh. Dijaga
  `ECON-4` di `server/economy-limits.test.ts`.
