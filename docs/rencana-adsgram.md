# Rencana integrasi iklan Adsgram

Status: **usulan, belum disetujui, belum ada kode.** Dokumen ini yang dikonfirmasi dulu
(aturan keras #1), baru implementasi jalan per fase.

Tujuan: menambah sumber pendapatan (iklan) tanpa menyentuh bentuk ekonomi yang sudah ada.
Yang dijaga dokumen ini bukan "iklannya tampil", tapi: **iklan tidak boleh menjadi cara
mencetak Rupiah yang tidak bisa dibiayai.** Reward pool tetap satu-satunya penahan bayaran.

Revisi: hadiah fase 1 bukan `+1 energi`, melainkan **satu tiket masuk task** yang
menggantikan biaya energi saat `startChallenge`. Alasannya di §2.

---

## 1. Apa itu Adsgram, dan bagian mana yang bisa dipercaya

Adsgram adalah jaringan iklan untuk Telegram Mini App. Yang relevan buat kita:

| Format | `blockId` | Cara pakai |
| --- | --- | --- |
| Reward (video/post berhadiah) | numerik, mis. `"123"` | `window.Adsgram.init({ blockId }).show()` → `Promise` |
| Interstitial | `int-xxx` | sama, tanpa hadiah |
| Task (native, subscribe channel) | `task-xxx` | web component `<adsgram-task>` |

SDK: `<script src="https://sad.adsgram.ai/js/sad.min.js">` atau paket `@adsgram/react`.
`show()` **resolve** kalau ditonton sampai habis, **reject** kalau di-skip/gagal/tidak ada
banner. Event yang tersedia: `onStart`, `onSkip`, `onReward`, `onComplete`, `onError`,
`onBannerNotFound`, `onNonStopShow`, `onTooLongSession`.

Dua hal yang menentukan seluruh desain di bawah:

1. **Resolve `show()` terjadi di klien.** Klien di app ini adalah pihak yang tidak
   dipercaya — sama seperti jawaban captcha tidak pernah divalidasi di klien. Jadi
   "promise resolve" bukan bukti tontonan, ia cuma *permintaan* hadiah.
2. **Verifikasi server-ke-server (Reward URL) belum bisa kita pakai.** Adsgram membuka
   fitur itu untuk publisher di atas ±50.000 DAU; bentuknya `GET` ke URL kita dengan
   parameter user id, dan tidak dikirim saat blok dalam mode debug. Selama kita di bawah
   ambang itu, hadiah iklan **selalu** berbasis klaim klien, dan satu-satunya pengaman
   adalah plafon, cooldown, jejak audit, dan sinyal fraud di sisi kita.

Konsekuensinya: fase 1 sengaja memberi hadiah yang **tidak bisa langsung ditarik jadi uang**.

---

## 2. Keputusan inti: iklan membayar biaya masuk task, bukan menambah energi

| Opsi | Efek | Risiko finansial kalau diklaim palsu |
| --- | --- | --- |
| **A. Tiket masuk task** (fase 1, dipilih) | satu task bisa dimulai tanpa memotong energi | **nol tambahan** — bayarannya tetap lewat reward pool + `daily_quotas`. Iklan hanya menaikkan tempo |
| B. `+1` energi ke `users.energy` | sama-sama menaikkan tempo | nol juga, tapi punya dua cacat di bawah |
| C. `+N` credit ke reward pool (fase 2) | menaikkan plafon bayaran user | biaya nyata: N × `creditValueIdr` per klaim; harus dibanding eCPM |
| D. `+N` credit ke saldo | uang langsung, bisa ditarik | pencetakan uang dari input klien, melewati reward pool. Dicoret |

Kenapa tiket mengalahkan `+1` energi, padahal efeknya mirip:

1. **Tidak tertabrak plafon energi.** `applyEnergyGrant` memotong di `maxEnergy()` dan
   `users_energy_range` (migrasi `0009`) mematok `energy <= 10` di database. Hadiah energi
   jadi hangus tanpa jejak saat energi penuh — user menonton iklan dan tidak mendapat
   apa-apa. Tiket disimpan sebagai baris tersendiri, jadi tidak pernah hangus diam-diam.
2. **Tidak mengganggu jam regen.** `applyEnergyGrant` menulis `energy_updated_at`; menambah
   energi lewat iklan menggeser jangkar regen dan membuat `nextAt`/`fullAt` di UI melompat.
   Tiket tidak menyentuh kolom energi sama sekali.
3. **Niatnya terbaca di data.** "Task ini dibayar iklan" tercatat di barisnya sendiri, jadi
   §7 bisa dijawab tanpa menebak: berapa task yang benar-benar tidak akan terjadi tanpa iklan.

Yang **tidak** berubah: `readRewardPool` tetap diperiksa sebelum task dimulai, dan
`consumeQuota` tetap memotong saat menang. Tiket membayar *ongkos masuk*, bukan hadiah.
Kolam kosong tetap menolak, dan tiketnya tidak terpakai.

---

## 3. Alur teknis yang diusulkan (fase 1)

Tiga langkah, semuanya diputuskan server. Pola tiket menyalin cara `challenges` bekerja:
server yang membuka sesi, klien yang melapor, server yang memutuskan.

```
klien                                  server
  │  POST /api/ads/ticket  ───────────▶ cek: iklan aktif? belum ada tiket 'ready'?
  │                                     kuota harian WIB & cooldown lewat?
  │  ◀─── { ticketId, blockId }          insert ad_views(state='pending')
  │
  │  AdController.show()  (Adsgram)
  │  resolve
  │  POST /api/ads/claim { ticketId } ─▶ lock tiket, harus 'pending' & belum kedaluwarsa
  │  ◀─── { pass: { expiresAt } }        state='ready', ready_at=now()
  │
  │  POST /api/task/start ────────────▶ transaction (satu-satunya tempat biaya dibayar):
  │       { challengeId }                 1. reward pool kosong? → tolak, tiket utuh
  │                                       2. ada tiket 'ready'?  → pakai itu: state='consumed',
  │                                          challenges.ad_view_id = tiket
  │  ◀─── { challenge, energy, paidBy }   3. kalau tidak ada     → spendEnergy() seperti sekarang
```

Kenapa tiket dua tahap (`pending` → `ready`), bukan satu endpoint: tanpa tiket,
`POST /api/ads/claim` adalah tombol "beri saya task gratis" yang bisa dipanggil dari luar
app. Dengan tiket, satu klaim harus didahului satu pembukaan sesi yang tercatat, dan rasio
`pending : ready` jadi metrik fraud yang bisa dibaca (klaim tanpa `pending` yang pernah
menganggur = tidak wajar).

Kenapa pembayaran tetap di `startChallenge`, bukan endpoint start terpisah: biaya masuk
sekarang dibayar di satu blok `transaction()` yang juga memegang `for update` atas baris
challenge. Menambah jalur start kedua berarti dua tempat yang boleh memulai task, dan
itu jalan pintas favorit untuk double-spend.

### Urutan pemakaian: tiket dulu, energi belakangan

Kalau user punya tiket **dan** energi, tiket yang dipakai. Alasannya: tiket punya
kedaluwarsa dan plafon harian, energi terisi sendiri — membiarkan tiket kedaluwarsa berarti
membuang hasil tontonan user. Konsekuensinya tombol iklan **hanya ditawarkan saat
`energy < energyCostPerTask`**, supaya user tidak menukar iklan dengan sesuatu yang
sebenarnya sudah ia punya.

### Pengembalian saat task hangus

`refundEnergy` sekarang dipanggil dari tiga tempat (`issueChallenge` saat menutup challenge
kedaluwarsa tanpa percobaan, `submitAnswer` saat `expired`, dan saat `pool_empty`). Ketiganya
harus mengembalikan **apa pun yang dipakai untuk masuk**, bukan selalu energi:

- `challenges.energy_spent_at is not null` → `grantEnergy` (perilaku sekarang).
- `challenges.ad_view_id is not null` → tiketnya dihidupkan kembali: `state='ready'`,
  `expires_at` diperpanjang dari `now()`, dan tayangan itu **tidak** dihitung ulang ke kuota
  harian (kuota dihitung dari `created_at`, bukan dari pemakaian).

Penanda idempotensinya tetap `challenges.energy_refunded_at` — satu kolom, artinya
diperluas menjadi "ongkos masuk sudah dikembalikan". Fungsinya lebih tepat dinamai
`refundEntry`, dan itu rename yang ikut di fase 1.

### Berkas yang disentuh

| Path | Perubahan |
| --- | --- |
| `db/migrations/0024_ads.sql` | tabel `ad_views`, `challenges.ad_view_id`, key baru `economy_config` (satu migrasi, wajib satu deploy dengan kodenya) |
| `domain/ads.ts` (+ `ads.test.ts`) | aturan murni: boleh menawarkan iklan atau tidak, alasan penolakan, hitung kedaluwarsa. Tanpa I/O |
| `server/ads.ts` | `openAdTicket`, `claimAdTicket`, `consumeAdPass`, `restoreAdPass` |
| `server/energy.ts` | `refundEnergy` → `refundEntry`; percabangan energi vs tiket; `grantEnergy` tetap privat |
| `server/challenge.ts` | `startChallenge`: coba `consumeAdPass` sebelum `spendEnergy`; simpan `ad_view_id`; kembalikan `paidBy: 'energy' \| 'ad'` |
| `app/api/ads/ticket/route.ts`, `app/api/ads/claim/route.ts` | handler; `assertSameOrigin` + `checkRateLimit` seperti `task/start` |
| `app/api/session/route.ts` | blok `ads: { enabled, blockId, viewsLeft, cooldownSecondsLeft, pass }` |
| `shell/session-api.ts`, `shell/use-ad-pass.ts` | tipe respons + hook: load SDK, `init` sekali per `blockId`, `destroy` saat unmount |
| `features/ads/watch-ad-to-play.tsx` | tombol; dirender di tempat pesan energi habis, bukan di dekat pips |
| `shell/use-task-flow.ts` | saat `ENERGY_EMPTY`: tawarkan iklan; setelah `claim` sukses, ulangi `start` yang sama |
| `app/layout.tsx` | `next/script` SDK Adsgram dengan `nonce`, `strategy="lazyOnload"` |
| `proxy.ts` | pelonggaran CSP (lihat §5) |
| `app/admin/(panel)/dashboard/page.tsx` | metrik iklan (lihat §7) |
| `.env.example`, `CLAUDE.md`, `docs/keputusan-desain.md` | env baru, peta direktori, alasan "kenapa tiket, bukan energi" |

### Skema

```sql
create table ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  block_id text not null,
  state text not null default 'pending',   -- pending | ready | consumed | expired
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,         -- pending: umur tiket, ready: umur pass
  ready_at timestamptz,
  consumed_at timestamptz,
  constraint ad_views_state_valid check (state in ('pending','ready','consumed','expired')),
  constraint ad_views_ready_needs_time check ((state = 'pending') = (ready_at is null)),
  constraint ad_views_consumed_needs_time check ((state = 'consumed') = (consumed_at is not null))
);

-- maksimum satu pass siap pakai per user: tidak bisa menumpuk stok
create unique index ad_views_one_ready on ad_views(user_id) where state = 'ready';
create unique index ad_views_one_pending on ad_views(user_id) where state = 'pending';
create index ad_views_user_idx on ad_views(user_id, created_at desc);

alter table challenges add column ad_view_id uuid references ad_views(id);
create unique index challenges_ad_view_unique on challenges(ad_view_id) where ad_view_id is not null;
```

Dua indeks unik parsial itu yang menjaga aturan "satu iklan = satu task": satu tiket
menganggur, satu pass siap, dan satu pass tidak bisa membayar dua challenge. Kuota harian
dihitung dari tabel ini dengan batas hari WIB `(now() at time zone 'Asia/Jakarta')::date`
(aturan keras #6); `daily_quotas` tidak ditambah kolom.

Satu catatan pada `challenges_ad_view_unique`: saat pass dihidupkan ulang oleh
`refundEntry`, `challenges.ad_view_id` pada challenge yang hangus **dikosongkan** supaya
tiket yang sama boleh dipakai lagi. Riwayat pemakaiannya tetap terbaca di `ad_views`.

---

## 4. Angka: di `economy_config`, bukan di kode

Aturan keras #2. Key baru (usulan awal, disetel dari panel admin):

| Key | Usulan | Arti |
| --- | --- | --- |
| `adsMaxViewsPerDay` | `10` | plafon tayangan berhadiah per user per hari WIB. **`0` = fitur mati**, tanpa deploy |
| `adsCooldownSeconds` | `120` | jarak minimum antar pembukaan tiket |
| `adsTicketTtlSeconds` | `300` | umur tiket `pending`; lewat itu klaim ditolak |
| `adsPassTtlMinutes` | `30` | umur pass `ready`; memaksa tiket dipakai, bukan ditimbun |

Tidak ada `adsRewardEnergy` lagi — besaran hadiahnya sudah tetap secara definisi: satu
tiket = satu ongkos masuk = `energyCostPerTask` yang tidak dipotong.

Catatan yang mudah dilupakan: `validateEconomyConfig` jalan juga saat **membaca** baris
`economy_config`. Baris tanpa key baru membuat `loadEconomyConfig` melempar
`ECONOMY_CONFIG_INVALID` untuk **setiap** request. Jadi migrasi `0024` wajib menyertai
deploy kodenya, bukan menyusul — persis peringatan di `0023_reward_pool.sql`.

Env baru (`.env.example`), bukan di `economy_config` karena ini identitas blok, bukan
besaran ekonomi:

```
NEXT_PUBLIC_ADSGRAM_BLOCK_ID=      # blockId Reward dari partner.adsgram.ai
NEXT_PUBLIC_ADSGRAM_DEBUG=false    # true hanya saat uji coba
```

Tanpa `NEXT_PUBLIC_ADSGRAM_BLOCK_ID`, `ads.enabled` dari `/api/session` bernilai `false`
dan tombolnya tidak dirender — dev lokal tetap jalan tanpa akun Adsgram.

---

## 5. CSP: bagian yang paling mungkin menggagalkan fase 1

`proxy.ts` sekarang `default-src 'self'` dengan `script-src` bernonce + `strict-dynamic`,
`frame-src 'self'`, `connect-src 'self'`. Iklan pihak ketiga melanggar hampir semuanya.
Domain kreatif Adsgram tidak didokumentasikan sebagai daftar tetap, jadi **jangan menebak
daftar host.** Urutannya:

1. Deploy percobaan dengan `CSP_REPORT_ONLY=1`, blok dalam mode debug, tombolnya hanya
   untuk admin.
2. Kumpulkan pelanggaran dari `/api/csp-report` yang sudah ada, susun daftar host nyata
   per direktif (`script-src`, `frame-src`, `img-src`, `media-src`, `connect-src`).
3. Baru longgarkan `proxy.ts` seminimal daftar itu, lalu matikan report-only.

`'strict-dynamic'` sudah membuat SDK yang dimuat `next/script` bernonce boleh memuat
turunannya di browser modern; entri host tetap ditulis sebagai jaring untuk browser yang
mengabaikan `strict-dynamic`. `frame-ancestors` **tidak** disentuh — app tetap hanya boleh
di-embed Telegram.

---

## 6. Anti-abuse

- `checkRateLimit('ads:ticket:<userId>', …)` dan `ads:claim:<userId>` di kedua handler,
  pola sama dengan `task/start`.
- Klaim hanya sah untuk tiket `pending` milik `userId` yang sama dan belum kedaluwarsa;
  seluruh transisi state di dalam `transaction()` dengan `for update`.
- Pemakaian pass terjadi di transaksi yang sama dengan start challenge, jadi "satu pass dua
  task" tidak mungkin lolos race — dijaga ganda oleh `challenges_ad_view_unique`.
- Batas atas keuntungan curang, kalau seluruh klaim palsu: `adsMaxViewsPerDay` task ekstra
  per hari, yang tetap dibayar dari reward pool dan `daily_quotas` user itu. Tidak ada
  Rupiah tambahan yang tercetak; yang naik hanya kecepatan menghabiskan plafonnya sendiri.
- Sinyal fraud baru di `fraud_signals` (kolomnya `text`, tidak butuh migrasi enum):
  `ad_claim_without_ticket`, `ad_claim_too_fast` (klaim < durasi minimum tontonan setelah
  tiket dibuka), `ad_claim_burst`.
- `onNonStopShow` dan `onTooLongSession` dari SDK dicatat sebagai alasan penolakan di
  klien, bukan sebagai hadiah.
- Tidak ada jalur dari iklan ke `credit_ledger` di fase 1. Enum `ledger_kind` tidak ditambah.

---

## 7. Cara menilai berhasil atau tidak

Panel admin (`dashboard`) menampilkan, per 7 hari:

- tiket dibuka → `ready` → `consumed` (tiga angka; jarak `ready`→`consumed` menunjukkan pass
  yang terbuang, jarak `pending`→`ready` menunjukkan fill rate dan indikasi abuse),
- `onBannerNotFound` per pembukaan — kalau tinggi, tombolnya lebih sering mengecewakan
  daripada menolong,
- task yang dibayar iklan vs dibayar energi, dan berapa persen di antaranya yang muncul
  **setelah** user kena `ENERGY_EMPTY` (itu ukuran task yang benar-benar tidak akan terjadi
  tanpa iklan),
- credit yang dibayarkan pada task berbayar iklan — ini biaya nyata fitur ini,
- **pendapatan Adsgram (dari dashboard partner, dimasukkan manual) vs credit di baris atas.**
  Ini angka yang menentukan fase 2 layak atau tidak.

Ambang keputusan: tinjau setelah 14 hari. Fill rate < 60%, atau pendapatan per tayangan <
credit yang dibayarkan per task berbayar iklan → fitur dimatikan lewat `adsMaxViewsPerDay=0`,
bukan revert.

---

## 8. Urutan kerja

**Fase 0 — akun & pengukuran (tanpa kode produksi).** Daftar `partner.adsgram.ai`, buat blok
Reward, catat `blockId`. Deploy percobaan report-only untuk memanen daftar host CSP (§5).

**Fase 1 — tiket masuk berhadiah iklan.** Migrasi `0024`; `domain/ads.ts` + tesnya;
`refundEnergy` → `refundEntry`; `server/ads.ts`; percabangan pembayaran di `startChallenge`;
dua route; blok `ads` di `/api/session`; hook + tombol di titik `ENERGY_EMPTY`; metrik admin;
CSP dilonggarkan sesuai temuan; `docs/keputusan-desain.md` ditambah barisnya.

Tes yang wajib ada di fase 1, karena di sinilah uang bisa bocor:

- pass dipakai → energi **tidak** berkurang, `ad_view_id` terisi;
- reward pool kosong → start ditolak dan pass tetap `ready`;
- task hangus tanpa percobaan → pass kembali `ready`, dan hanya sekali (idempoten);
- dua `start` serentak dengan satu pass → hanya satu yang berhasil;
- kuota harian habis → `POST /api/ads/ticket` menolak, tanpa membuka tiket;
- pass kedaluwarsa → start jatuh kembali ke energi, bukan gratis.

**Fase 2 — kandidat, butuh persetujuan terpisah.** Iklan mengisi reward pool
(`adsRewardPoolCredits`), hanya kalau angka §7 mendukung, dengan plafon harian sendiri.
Interstitial di sela task juga masuk fase ini — ia mengganggu alur yang sekarang menjadi
sumber retensi.

**Fase 3 — kalau DAU melewati ambang Adsgram.** Pasang Reward URL server-ke-server sebagai
verifikasi kedua: tiket `pending` baru menjadi `ready` setelah callback Adsgram cocok, bukan
karena POST dari klien. Saat itu plafon harian bisa dilonggarkan karena buktinya tidak lagi
dari klien.

Sebelum tiap fase dinyatakan selesai: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`,
`pnpm build`.

---

## 9. Yang masih harus diputuskan pemilik repo

1. Setuju tiket masuk (opsi A) dengan aturan "hanya ditawarkan saat energi kurang dari
   `energyCostPerTask`"? Atau tombolnya boleh muncul kapan saja supaya user bisa menyimpan
   satu pass di depan?
2. Angka awal §4 — dipakai apa adanya atau disetel lain? Khususnya `adsPassTtlMinutes`:
   makin panjang, makin banyak pass menganggur; makin pendek, makin sering user merasa
   hasil tontonannya hilang.
3. Rename `refundEnergy` → `refundEntry` sekarang (satu fase, satu diff besar), atau tetap
   `refundEnergy` dengan percabangan di dalamnya?
4. Interstitial ditunda ke fase 2, atau dicoret sama sekali?
5. Blok Task (`task-xxx`, subscribe channel) di halaman `referral` — dibahas nanti atau
   dicoret? Hadiahnya per akun dan sekali pakai, profil fraudnya berbeda dari Reward.
