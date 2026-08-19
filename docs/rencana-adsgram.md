# Rencana integrasi iklan Adsgram

Status: **usulan, belum disetujui, belum ada kode.** Dokumen ini yang dikonfirmasi dulu
(aturan keras #1), baru implementasi jalan per fase.

Tujuan: menambah sumber pendapatan (iklan) tanpa menyentuh bentuk ekonomi yang sudah ada.
Yang dijaga dokumen ini bukan "iklannya tampil", tapi: **iklan tidak boleh menjadi cara
mencetak Rupiah yang tidak bisa dibiayai.** Reward pool tetap satu-satunya penahan bayaran.

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

## 2. Keputusan inti: iklan membeli waktu, bukan uang

Tiga bentuk hadiah yang mungkin, dan kenapa urutannya begini:

| Opsi | Efek | Risiko finansial kalau diklaim palsu |
| --- | --- | --- |
| **A. +1 energi** (fase 1) | user boleh mengerjakan task lebih cepat | **nol tambahan** — bayaran tetap dipotong reward pool. Iklan hanya mempercepat tempo, tidak menaikkan plafon |
| **B. +N credit ke reward pool** (fase 2) | menaikkan plafon bayaran user | biaya nyata: N × `creditValueIdr` per klaim. Harus dibandingkan dengan eCPM |
| **C. +N credit ke saldo** (tidak direkomendasikan) | uang langsung, bisa ditarik | pencetakan uang lewat endpoint yang inputnya dari klien. Melewati reward pool, melewati `daily_quotas`. Jangan |

Rekomendasi: **kerjakan A, ukur, baru pertimbangkan B. C dicoret.**

Satu jebakan penting pada opsi A: `applyEnergyGrant` memotong di `maxEnergy()`, dan
`users_energy_range` (migrasi `0009`) mematok `energy <= 10` di database. Artinya energi
**tidak bisa ditumpuk** di atas kapasitas. Jadi tombol iklan hanya boleh muncul saat
`energy < max`; kalau tidak, user menonton iklan dan tidak mendapat apa-apa — itu keluhan
support, bukan fitur.

---

## 3. Alur teknis yang diusulkan (fase 1)

Bentuknya menyalin pola `challenges`: server yang membuka sesi, klien yang melapor, server
yang memutuskan. Tiket sekali pakai, bukan "percaya POST dari klien".

```
klien                                  server
  │  POST /api/ads/ticket  ───────────▶ cek: iklan aktif? energy < max?
  │                                     kuota harian & cooldown belum lewat?
  │  ◀─── { ticketId, blockId }          insert ad_views(state='pending')
  │
  │  AdController.show()  (Adsgram)
  │  resolve
  │  POST /api/ads/claim { ticketId } ─▶ transaction:
  │                                       lock tiket, tolak kalau bukan 'pending'
  │                                       tolak kalau lewat kedaluwarsa
  │                                       grantEnergy(...)  ← satu-satunya penulis energi
  │  ◀─── { energy }                     state='rewarded', rewarded_at=now()
```

Kenapa tiket, bukan satu endpoint saja: tanpa tiket, `POST /api/ads/claim` adalah tombol
"tambah energi" yang bisa dipanggil berulang di luar app. Dengan tiket, satu klaim harus
didahului satu pembukaan sesi yang tercatat, dan rasio `pending : rewarded` jadi metrik
fraud yang bisa dibaca (klaim 100% tanpa `pending` yang menganggur = tidak wajar).

### Berkas yang disentuh

| Path | Perubahan |
| --- | --- |
| `db/migrations/0024_ads.sql` | tabel `ad_views` + key baru di `economy_config` (satu migrasi, wajib satu deploy dengan kodenya) |
| `domain/ads.ts` (+ `ads.test.ts`) | aturan murni: boleh tayang atau tidak, hadiah berapa, alasan penolakan. Tanpa I/O |
| `server/ads.ts` | `openAdTicket`, `claimAdReward`; memanggil `grantEnergy` (perlu diekspor dari `server/energy.ts`) |
| `app/api/ads/ticket/route.ts`, `app/api/ads/claim/route.ts` | handler; `assertSameOrigin` + `checkRateLimit` seperti `task/start` |
| `app/api/session/route.ts` | tambah blok `ads: { enabled, blockId, viewsLeft, cooldownSecondsLeft, rewardEnergy }` |
| `shell/session-api.ts`, `shell/use-ad-reward.ts` | tipe respons + hook: load SDK, `init` sekali per `blockId`, `destroy` saat unmount |
| `features/ads/watch-ad-button.tsx` | tombol, dipakai dari `features/home` di dekat `energy-pips` |
| `app/layout.tsx` | `next/script` SDK Adsgram dengan `nonce`, `strategy="lazyOnload"` |
| `proxy.ts` | pelonggaran CSP (lihat §5) |
| `app/admin/(panel)/dashboard/page.tsx` | metrik iklan (lihat §7) |
| `.env.example`, `CLAUDE.md`, `docs/keputusan-desain.md` | env baru, peta direktori, dan alasan "kenapa hadiahnya energi" |

### `ad_views`

```sql
create table ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete cascade,
  block_id text not null,
  state text not null default 'pending',      -- pending | rewarded | expired
  reward_energy smallint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  rewarded_at timestamptz,
  constraint ad_views_reward_needs_state
    check ((state = 'rewarded') = (rewarded_at is not null))
);
create index ad_views_user_idx on ad_views(user_id, created_at desc);
```

Satu baris per tayangan, bukan penghitung harian: kuota harian dihitung dari tabel ini
dengan batas hari WIB `(now() at time zone 'Asia/Jakarta')::date` (aturan keras #6), dan
tabel yang sama sekaligus jadi jejak audit. `daily_quotas` tidak ditambah kolom — isinya
sekarang khusus jaring anti-bot task dan plafon komisi.

---

## 4. Angka: di `economy_config`, bukan di kode

Aturan keras #2. Key baru (nilai di bawah ini usulan awal, disetel dari panel admin):

| Key | Usulan | Arti |
| --- | --- | --- |
| `adsRewardEnergy` | `1` | energi per iklan yang selesai ditonton |
| `adsMaxViewsPerDay` | `10` | plafon tayangan berhadiah per user per hari WIB. **`0` = fitur mati**, tanpa deploy |
| `adsCooldownSeconds` | `120` | jarak minimum antar tayangan berhadiah |
| `adsTicketTtlSeconds` | `300` | umur tiket; lewat itu klaim ditolak |

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
  transisi state di dalam `transaction()` dengan `for update` (idempoten seperti
  `energy_refunded_at`).
- Sinyal fraud baru di `fraud_signals` (kolomnya `text`, tidak butuh migrasi enum):
  `ad_claim_without_ticket`, `ad_claim_too_fast` (klaim < durasi minimum tontonan setelah
  tiket dibuka), `ad_claim_burst`.
- `onNonStopShow` dan `onTooLongSession` dari SDK dicatat sebagai alasan penolakan di
  klien, bukan sebagai hadiah.
- Tidak ada jalur dari iklan ke `credit_ledger` di fase 1. Enum `ledger_kind` tidak
  ditambah — kalau nanti fase 2 disetujui, hadiahnya masuk `users.reward_pool` (kapasitas),
  yang juga bukan `credit_ledger`.

---

## 7. Cara menilai berhasil atau tidak

Panel admin (`dashboard`) menampilkan, per 7 hari:

- tiket dibuka vs hadiah diberikan (rasio isi/fill dan indikasi abuse),
- `onBannerNotFound` per tayangan — kalau tinggi, tombolnya lebih sering mengecewakan
  daripada memberi,
- energi yang diberikan iklan vs energi dari regen,
- task selesai per user pada hari ia menonton iklan vs hari ia tidak,
- **pendapatan Adsgram (dari dashboard partner, dimasukkan manual) vs credit yang dibayar
  reward pool pada periode yang sama.** Ini angka yang menentukan fase 2 layak atau tidak;
  fase 2 hanya masuk akal kalau pendapatan per tayangan > `adsRewardEnergy` yang akhirnya
  terkonversi jadi credit.

Ambang keputusan yang diusulkan: tinjau setelah 14 hari. Fill rate < 60% atau pendapatan
per tayangan < nilai credit yang dibayar → fitur dimatikan lewat `adsMaxViewsPerDay=0`,
bukan revert.

---

## 8. Urutan kerja

**Fase 0 — akun & pengukuran (tanpa kode produksi).** Daftar `partner.adsgram.ai`, buat blok
Reward, catat `blockId`. Deploy percobaan report-only untuk memanen daftar host CSP (§5).

**Fase 1 — energi berhadiah iklan.** Migrasi `0024`, `domain/ads.ts` + tesnya, `server/ads.ts`,
dua route, blok `ads` di `/api/session`, hook + tombol di beranda (hanya saat `energy < max`),
metrik admin, CSP dilonggarkan sesuai temuan, `docs/keputusan-desain.md` ditambah barisnya.

**Fase 2 — kandidat, butuh persetujuan terpisah.** Iklan mengisi reward pool
(`adsRewardPoolCredits`), hanya kalau angka §7 mendukung, dan hanya dengan plafon harian
sendiri. Interstitial di sela task juga masuk fase ini, bukan fase 1 — ia mengganggu alur
yang sekarang menjadi sumber retensi.

**Fase 3 — kalau DAU melewati ambang Adsgram.** Pasang Reward URL server-ke-server sebagai
verifikasi kedua: klaim klien menjadi `pending` yang baru dibayar setelah callback Adsgram
cocok. Saat itu plafon harian bisa dilonggarkan karena buktinya tidak lagi dari klien.

Sebelum tiap fase dinyatakan selesai: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`,
`pnpm build`.

---

## 9. Yang masih harus diputuskan pemilik repo

1. Setuju hadiah fase 1 = energi (opsi A), bukan credit?
2. Angka awal §4 — dipakai apa adanya atau disetel lain?
3. Tombolnya di beranda dekat pips energi, atau muncul sebagai tawaran saat energi habis
   (di tempat pesan "Energi kamu habis")?
4. Interstitial ditunda ke fase 2, atau dicoret sama sekali?
5. Blok Task (`task-xxx`, subscribe channel) di halaman `referral` — dibahas nanti atau
   dicoret? Hadiahnya per akun dan sekali pakai, profil fraudnya berbeda dari Reward.
