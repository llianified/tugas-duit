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
| `daily_quotas.tasks_completed` dinaikkan dulu, lalu **dikembalikan** kalau task-nya tidak dibayar | Penghitungnya dinaikkan lebih dulu supaya kenaikannya ikut terkunci baris `daily_quotas` yang sama, bukan karena penolakan ikut dihitung. Tanpa pengembaliannya jaring anti-bot menghitung percobaan alih-alih task, dan user yang sekali menabrak plafon tidak akan pernah turun lagi dari plafon itu di hari yang sama. | `consumeQuota`; test `AUDIT-1` |
| Penghasilan task ditahan kolam yang mengisi ulang bertahap, **bukan** plafon yang reset tengah malam | Reset harian memusatkan seluruh permintaan di satu jam dan menghukum user yang zona waktunya berbeda. Kolam memberi alasan untuk kembali tanpa tenggat. Bentuknya sengaja dikembarkan dengan energi. | `domain/reward-pool.ts`; migrasi `0023` |
| Reward yang lebih besar dari sisa kolam **dipotong**, bukan ditolak | Task yang sudah dijawab benar tetap dibayar sebagian; menolaknya menghanguskan usaha user hanya karena kolamnya kurang satu credit. | `applyRewardPoolSpend`; test `pays only what is left instead of refusing the last task` |
| Bonus rank dan streak menambah kapasitas kolam, bukan laju isi ulangnya | Kapasitas mengubah berapa yang bisa ditumpuk lalu dihabiskan dalam satu sesi, tanpa menaikkan penghasilan maksimum per hari. Menaikkan laju menggeser seluruh biaya jangka panjang. | `rewardPoolCapacity`; `domain/reward-pool.test.ts` |
| Menit yang belum genap satu interval tidak hangus saat kolam dibelanjakan | Jam acuan hanya dimajukan sebanyak interval yang benar-benar dibayar. Tanpa ini, user yang membuka app tepat sebelum interval genap kehilangan progres isi ulangnya setiap kali. | `regenAnchor` di `domain/reward-pool.ts` |
| Iklan memberi **tiket masuk task**, bukan energi atau credit | Hadiah energi hangus tanpa jejak saat energi penuh (`applyEnergyGrant` memotong di `maxEnergy()`) dan menggeser jangkar regen sehingga hitung mundur di UI melompat. Tiket disimpan sebagai barisnya sendiri, jadi tidak pernah hangus diam-diam dan niatnya terbaca di data. Yang lebih penting: tiket tidak mencetak Rupiah — bayarannya tetap lewat kolam reward dan `daily_quotas`, jadi klaim palsu hanya mempercepat user menghabiskan plafonnya sendiri. | migrasi `0024`; `server/ads.ts` |
| Klaim iklan dipercaya apa adanya dari klien | Verifikasi server-ke-server (Reward URL) baru dibuka Adsgram di atas ±50.000 DAU. Selama di bawah itu, pengamannya bukan bukti tontonan melainkan plafon harian, cooldown, dua indeks unik parsial, dan sinyal fraud. Karena itu hadiahnya sengaja dipilih yang tidak bisa langsung ditarik jadi uang. | `server/ads.ts`; migrasi `0024`; test `ADS-DB` |
| `challenges.ad_view_id` **tidak** dikosongkan saat tiketnya dikembalikan | Tiket yang dihidupkan ulang harus boleh membayar challenge berikutnya, dan itu diurus indeks `challenges_ad_view_unique` yang disempitkan ke `energy_refunded_at is null` — bukan dengan menghapus jejaknya. Mengosongkan kolomnya akan melepas satu-satunya bukti bahwa challenge itu pernah membayar ongkos masuk, dan constraint `challenges_entry_refund_needs_entry` kehilangan pijakannya. | migrasi `0024`; test `ADS-DB-3` |
| Interstitial otomatis memanggil `show_<zone>()` **polos**, bukan `show_<zone>({ type: 'inApp', inAppSettings })` | Parameter `type: 'inApp'` bukan "tayangkan satu iklan in-app", melainkan "titipkan jadwal in-app ke SDK" — dan jadwal itu tidak punya API untuk dibatalkan. Percobaan menetralkannya lewat `capping: 0, interval: 0` justru menghapus seluruh plafon (jendela nol jam tidak pernah membatasi apa pun), sehingga tiap panggilan meninggalkan satu penjadwal abadi dan iklannya menumpuk berlapis-lapis di produksi. Jadwalnya sekarang sepenuhnya milik `domain/in-app-ads.ts`, dan SDK hanya diminta satu iklan per panggilan — bentuk yang sama dengan jalur berhadiah. | `shell/use-in-app-ads.ts`; test `INAPP-1` |
| Tombol iklan tetap muncul walau energi masih penuh | Kartu task menawarkan dua cara bayar berdampingan, dan klien mengirim `payWith` secara eksplisit — server tidak pernah diam-diam memakai tiket saat user menekan tombol energi. Pass yang belum dipakai hangus lewat `adsPassTtlMinutes`, bukan diam-diam terpakai. | `startChallenge`; `features/home/active-task.tsx` |
| Tiket iklan tidak boleh dibuka selama task yang dibayarinya belum ditutup | Pass yang sudah dipakai baru bisa dihidupkan lagi kalau slot `ad_views_one_ready` kosong. Tanpa penjaga ini, user yang menonton iklan baru selagi task berbayar-tiket masih jalan membuat tiket lamanya tidak bisa dikembalikan saat task itu hangus — tiketnya hilang tanpa jejak. Menolak di depan lebih murah daripada menambah stok pass. | `adOpenRefusal` (`entry_open`); test `ADS-DB-7` |
| Membuka tiket dua kali menyerahkan tiket yang **sama**, bukan menolak | Tiket adalah izin menonton satu iklan, bukan hasil tontonan. Kalau SDK Adsgram gagal dimuat atau tayangannya batal, izin itu masih berlaku sampai `adsTicketTtlSeconds` habis; menolak permintaan berikutnya hanya mengunci user 5 menit tanpa menambah pengaman apa pun. Barisnya tetap satu, jadi `ad_views_one_pending` tidak berubah artinya. | `openAdTicket`; test `ADS-DB-8` |
| Premium mematikan **interstitial otomatis saja**, tiket berhadiah tetap hidup | Alasannya jujur soal pemasukan: iklan berhadiah adalah impresi yang membayari reward pool, dan mematikannya untuk pembeli premium menghapus pendapatan tanpa menghapus keluhan — yang mengganggu itu iklan yang nongol sendiri, bukan tombol yang mereka tekan sendiri. Karena itu `ads.enabled` (tiket, opt-in) dipisah dari `ads.inAppEnabled` (otomatis), dan larangan premium dicabut dari `openAdTicket` supaya server tidak menolak tombol yang klien masih render. Konsekuensinya wajib dibayar di copy: judul manfaatnya tidak boleh berbunyi "bebas iklan", dan daftar manfaat menyebut sendiri bahwa premium bukan nol iklan. | `readAdsState`; `features/premium/benefits.ts`; test di `server/premium.test.ts` |
| Jatah tayangan harian dihitung dari tiket yang **diklaim**, bukan yang dibuka | Plafonnya plafon hadiah. Tiket yang iklannya tidak pernah selesai tayang tidak memberi apa pun, jadi memotongnya dari jatah menghukum user atas kegagalan jaringan. Yang menahan pembukaan tiket beruntun tetap `ad_views_one_pending` plus cooldown. | `STATE_SQL` (`ready_at is not null`); test `ADS-DB-8` |
| Reward dijepit ke `challenges.max_reward`, bukan menolak pembayaran | `max_reward` adalah plafon yang dijanjikan ke user saat soalnya terbit. Kalau admin menaikkan reward selagi soal itu beredar, membayar angka baru berarti membayar di atas yang ditampilkan; melempar error berarti soalnya macet dan user terkunci sampai kedaluwarsa. Dijepit membayar tepat sebesar janjinya. | `submitAnswer`; test `ECON-5` |
| Batas task harian dan kolam kosong adalah dua penolakan berbeda | Keduanya sama-sama mengembalikan ongkos masuk, tapi obatnya berbeda: kolam terisi sendiri dalam hitungan menit, plafon harian baru lepas besok. Satu pesan untuk dua sebab membuat user menunggu sesuatu yang tidak akan datang. | `consumeQuota` (`QuotaRefusal`); `app/api/task/submit/route.ts` |
| `referralCommissionPercent` tidak boleh 0, padahal 0% terdengar seperti "matikan komisi" | Pada 0% `commissionUnitsForReward` bernilai nol dan `accrueCommission` berhenti sebelum menulis baris. Syarat penarikan menghitung downline dari `referral_commissions`, jadi 0% mengunci penarikan setiap user yang belum terlanjur memenuhi syaratnya — diam-diam, tanpa pesan yang menjelaskan. Gerbang 5 referral sendiri konstanta kode, tidak bisa dimatikan dari panel, jadi 0% tidak punya pasangan setelan yang membuatnya sah. | `min: 1` di `ECONOMY_FIELDS`; test `komisi nol mengunci syarat penarikan` |
| Kelayakan penarikan dibaca satu fungsi (`readEligibility`), bukan dihitung ulang di tiap pemanggil | Dulu jalur baca dan jalur tulis punya SQL kembar. Saat premium menambah jeda 3 hari hanya jalur tulis yang ikut berubah, sehingga UI menahan pembeli premium sampai hari ketujuh padahal server sudah menerimanya sejak hari ketiga — mereka membayar untuk manfaat yang tidak bisa dipakai. Jeda dan syaratnya juga tidak boleh disalin ke teks UI: `cooldownDays` ikut dikirim supaya kalimatnya mengikuti aturan yang benar-benar berlaku untuk orang itu. | `server/payout.ts`; test `WD-9`, `WD-10` |
| Setiap route yang memakai sesi wajib memanggil `checkRateLimit` | Bukan selera, melainkan aturan yang diuji: `GET /api/withdrawals` dan seluruh permukaan admin sempat lolos tanpa plafon, dan itu hanya terlihat saat membandingkan semua route sekaligus. | test `RL-2` |
| Syarat penarikan memakai **hari aktif berbeda**, bukan umur akun dan bukan streak | Umur akun tidak menuntut apa pun — pabrik akun cukup menunggu seminggu, dan burst 34 akun 25 Agu akan lolos serentak di hari ketujuh. Streak menuntut terlalu banyak ke arah sebaliknya: satu hari bolong menghapus seluruh progres user jujur. Hari aktif berbeda menuntut task betulan di tujuh hari terpisah tanpa menghukum yang bolong. Batas harinya WIB, sama seperti seluruh konsep "hari" di repo ini. | `REQUIRED_ACTIVE_DAYS`; `ELIGIBILITY_SQL` di `payout.ts`; test `WD-11` |
| Angka ekonomi tidak ada di kode | Semuanya dari `domain/economy-config.ts`, dipasang dari DB per request lewat `loadEconomyConfig()`. Menyetel ekonomi lewat panel admin, bukan deploy. | aturan keras #2 di `CLAUDE.md` |
| Gerbang wajib join channel **meloloskan** user yang keanggotaannya tidak bisa dipastikan | `readChannelMembership` mengembalikan `null` untuk tiga hal yang bukan salah user: Telegram down, token salah, dan bot yang bukan admin channel. Menutup gerbang di situ berarti satu gangguan di pihak kami mengunci seluruh basis user sekaligus. Yang menahan panggilan beruntun selama gangguan itu `outageUntil` di memori proses — peredam badai, bukan penyimpan keputusan. | `readChannelGateState`; test `CHAN-GATE … meloloskan user saat keanggotaan tidak bisa dipastikan` |
| Gerbang menutup seluruh app di klien, tapi di server hanya menjaga `POST /api/task/start` | Yang perlu ditegakkan di server adalah jalur yang **mencetak** credit, karena gerbang klien saja bisa dilewati dengan memanggil API langsung. Penarikan sengaja tidak ikut dijaga: memblokirnya menyandera saldo yang sudah terkumpul sebelum gerbangnya menyala, dan itu tidak menutup celah apa pun. Submit juga tidak dijaga — task yang ongkos masuknya sudah dibayar harus boleh diselesaikan. | `channelGateBlocks` di `app/api/task/start/route.ts` |
| Hasil "bukan anggota" hanya disimpan semenit, hasil "anggota" berjam-jam | Umur cache-nya mengikuti siapa yang sedang menunggu. User yang baru saja join berdiri di depan layar gerbangnya dan menekan "Saya sudah join"; menahannya di cache lama berarti menyuruh orang yang sudah menurut untuk menunggu tanpa sebab. Sebaliknya orang jarang keluar channel, jadi hasil positif boleh awet. Tombolnya sendiri memaksa cek ulang lewat `force`, jadi cache negatif bukan satu-satunya jalan keluar. | `MEMBER_TTL_MS`/`NON_MEMBER_TTL_MS` di `server/channel.ts`; test `CHAN-GATE … memaksa cek ulang` |
| Penanda gerbang tidak menumpang `channel_bonus_claimed_at` | Kolom bonus tidak pernah kembali ke null, jadi user yang klaim bonus lalu keluar dari channel akan terbaca sebagai anggota selamanya. Gerbang menuntut jawaban yang bisa berubah, dan tiga kemungkinan — anggota, bukan anggota, belum pernah dicek — tidak muat di satu timestamp. | migrasi `0033` |
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
| `FLOOR_MS` dan `SWEEP_THRESHOLDS` di `server/fraud.ts` | Ambang sinyal anti-fraud. Ia hanya mencatat, tidak pernah mengubah reward maupun menolak pembayaran. Angkanya dikalibrasi dari sebaran nyata produksi, bukan ditebak: `identicalTimingMaxSpreadMs` 600 berdiri di bawah lantai manusia paling konsisten yang terukur (1.877ms), dan `noWrongMaxErrorRatio` 1% berdiri di bawah rata-rata populasi (~6,5%). |
| Batas retensi, ukuran halaman, rate limit, umur sesi | Operasional, bukan ekonomi. |
| `referralBurstLookbackMinutes` (1.500) jauh lebih panjang dari `referralBurstWindowMinutes` (10) | Dua angka berbeda karena menjawab dua hal berbeda: yang pertama **seberapa jauh ke belakang disapu**, yang kedua **serapat apa yang dicari**. Versi pertama menyatukan keduanya jadi satu jendela 10 menit, padahal cron waktu itu jalan sekali sejam (`railway.cron.json`) — jadi 50 dari 60 menit tidak pernah terlihat dan detektornya menulis nol baris selama dua belas hari. Rentang sapuan harus selalu melampaui periode cron: sekarang 25 jam, menutupi cron harian di `vercel.json` dengan margin satu jam. Kerapatannya tetap sempit supaya artinya tidak tumpul. Dijaga test `FRAUD-4`, yang gagal kalau jadwal cron diubah tanpa menaikkan rentangnya. |

Satu batas datang dari database, bukan dari selera: `maxAttemptsPerTask`
maksimal 5, karena `challenges.attempts` punya `check (attempts between 0 and
5)`. Menaikkan batasnya berarti satu migrasi lebih dulu.

## Pesan bot

| Yang terlihat janggal | Kenapa memang begitu | Ditegakkan di |
| --- | --- | --- |
| Pesan ajakan dikirim dari cron tiap jam, bukan dari alur yang memicunya | Mengirim HTTP ke Telegram di dalam transaksi yang memegang `for update` pada baris `users` menahan kunci selama panggilan jaringan — di jalur uang itu tidak boleh. Cron juga yang membuat "komisi masuk" jadi satu ringkasan harian, bukan belasan pesan per hari. | `server/engagement.ts`; `scripts/maintenance.ts` |
| Penanda `bot_notifications` ditulis **sebelum** pesannya dikirim | `bot_notifications_once` cuma menjamin sesuatu kalau barisnya sudah commit sebelum panggilan Telegram. Kirim yang gagal menghapus penandanya lagi, jadi cron berikutnya boleh mencoba ulang — telat sejam lebih baik daripada hilang diam-diam, dan dua-duanya lebih baik daripada satu pesan berangkat dua kali. | `deliver`; test `ENG-9` |
| Satu user paling banyak menerima **satu** pesan per putaran cron | Semua syarat bisa terpenuhi berbarengan (energi penuh + stok penuh + streak sore). Mengirim semuanya membuat bot terbaca sebagai spam dan mengundang laporan. Urutan prioritasnya tetap: penarikan → rank → streak → komisi → referral → winback → stok → energi. | `pickMessage` |
| `rank_up` menengok jumlah task 24 jam lalu, bukan cuma rank sekarang | Tanpa pembanding itu, putaran cron pertama setelah deploy mengucapkan selamat naik rank ke setiap user yang sudah lama di rank-nya. `dedupe_key`-nya tingkat rank, jadi pesannya tetap sekali per tingkat. | `completed_count_before`; test `ENG-5` |
| Streak di `engagement.ts` dihitung sampai **kemarin**, bukan sampai hari ini seperti `STREAK_EXPRESSION` | Pesannya justru untuk user yang belum menyentuh task hari ini, jadi hari ini tidak boleh ikut menambah angkanya. Batas harinya tetap WIB dan bentuk querinya tetap sama. | `STREAK_SQL`; test `ENG-3` |
| `/stop` tidak mematikan notifikasi penarikan | Yang dimatikan promosi, bukan kabar uang. User yang mengajukan penarikan berhak tahu hasilnya. | migrasi `0026`; `server/notify.ts` |
| `server/engagement.ts` memakai impor relatif ber-`.ts`, bukan alias `@/` | Ia dimuat cron lewat `node --experimental-strip-types`, dan Node tidak mengerti alias `@/...` dari tsconfig. Impor **tipe** boleh tetap beralias karena dihapus saat strip. Alasan yang sama membuat `payout-rules.ts` dipisah dari `payout.ts`: yang terakhir menyeret `next/headers` lewat `./session`. | `server/engagement.ts`; `server/payout-rules.ts` |

## Nama "kolam" tinggal di kode, tidak di layar

`reward_pool`, `rewardPoolCapacity`, dan seluruh nama fungsi tetap memakai "pool"/"kolam".
Yang dilihat user memakai **"stok reward"** — dikonfirmasi pemilik repo, karena "kolam"
terbaca seperti kolam renang. Jangan menyamakan keduanya dengan rename massal: nama kode
sudah dipakai di migrasi, kolom DB, dan test. Label panel admin masih memakai "kolam" dan
itu belum diputuskan; admin panel dibaca pemilik repo, bukan user.

Sebelumnya pill kolam di header berlabel **"Limit harian"** — sisa dari plafon harian yang
sudah diganti migrasi `0023`. Sekarang "Stok reward", karena tidak ada lagi yang reset
tengah malam.

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

Panel pill profil sengaja hanya memuat empat baris ringkasan — identitas, task,
kualitas, saldo — lalu menutup dengan tombol "Lihat statistik", **bukan** seluruh
angka view Statistik. Tinggi panel island dianimasikan dari `scrollHeight`; isi
sepanjang view Statistik akan melewati tinggi layar 384×639 dan menuntut scroll
di dalam header, bentuk yang tidak ada di tempat lain di app ini. Streak juga
sengaja tidak diulang karena sudah jadi satu region di panel rank.

Pill profil **hilang di view task** (`captcha`). Di lebar 384px tiga pill
menyisakan ruang terlalu tipis, dan saat mengerjakan task yang relevan tinggal
rank dan kesulitan. Karena `.brand-band-row` di-center, pill yang hilang membuat
klaster tier+sulit recenter sendiri, dan `useIslandGeometry` mengukur ulang lewat
observer barisnya. `ProgressionBadges` mereset `openPanel` saat pill sumbernya
berhenti dirender supaya panel tidak tertinggal terbuka pada komponen yang sudah
di-unmount.

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
