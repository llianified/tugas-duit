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
