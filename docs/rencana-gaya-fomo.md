# Rencana Adopsi Gaya Visual "fomo"

> **Untuk agent (Claude Code / v0 / lainnya):** dokumen ini adalah satu-satunya sumber
> kebenaran untuk pekerjaan ini. Baca **BAB 0 (Aturan Wajib)** sebelum menyentuh file
> apa pun, lalu kerjakan **BAB 3** secara berurutan sambil mencentang ceklisnya.
>
> Setiap kali menyelesaikan satu langkah: ubah `- [ ]` menjadi `- [x]` **di file ini**
> dan commit. Jangan mengerjakan langkah N+1 sebelum langkah N tercentang.

---

## BAB 0 — Aturan Wajib (baca dulu, jangan dilewat)

### 0.1 Zona terlarang — JANGAN DISENTUH

Ini bukan preferensi, ini larangan keras. Melanggar = rollback.

| Berkas / selektor | Alasan |
| --- | --- |
| `navigation/nav-pill.tsx` | Dikalibrasi manual agar menyatu dengan komponen fullscreen bawaan Telegram. Sangat sulit diatur ulang. |
| `.nav-pill`, `.nav-pill-row`, `.nav-pill-item`, `.nav-pill-label` di `app/globals.css` | Idem. Geometri nav pill terkunci. |
| Token `--nav-pill-h`, `--nav-pill-gap` | Idem. Dipakai untuk menghitung inset konten. |
| `.pb-nav-inset`, `--telegram-safe-*`, `--telegram-content-safe-*` | Rantai perhitungan safe-area Telegram. |
| `features/home/*island*` + `.island*` + `--island-*` | Sistem island (geometri animasi presisi): `difficulty-island.tsx`, `profile-island.tsx`, `rank-island.tsx`, `island-pill.tsx`, `use-island-geometry.ts`. |
| `shell/telegram-viewport.ts`, `shell/theme-init.ts` | Integrasi viewport & anti-FOUC tema. |
| `features/captcha/**` | Logika + animasi papan captcha. Boleh ikut token global, tapi jangan direstruktur. |

**Konsekuensi:** rencana ini **tidak** memuat "nav pill icon-only ala fomo".
Ide itu dibatalkan permanen. Jangan dihidupkan ulang.

### 0.2 Yang diadopsi vs ditolak dari fomo

fomo adalah aplikasi trading kripto dark-only. Aplikasi ini adalah Telegram Mini App
tugas berhadiah dalam Rupiah, dua tema. Jadi:

**Diadopsi (murni presentasi):**
1. Tombol solid dengan hairline "gelas" (radius besar, teks berat) — bukan
   depth 3D / neobrutalism.
2. Angka besar dengan desimal diredam (`$0` terang + `.00` abu-abu).
3. Kartu "diri sendiri" tersorot di daftar peringkat.
4. Segmented waktu polos + chip dropdown filter.
5. Rail kartu horizontal (scroll-snap).
6. Chip badge padat & berat di samping nama.
7. Avatar bertumpuk + penghitung sisa (`65+`).
8. Medali pita untuk 3 teratas.
9. Feed bergaya thread dengan garis penghubung + "Baca selengkapnya".
10. Kartu pengumuman "Disematkan" di pucuk feed.
11. Typeface grotesk geometrik berat untuk heading & angka.

**Ditolak — jangan ditiru:**
- **Dark-only.** Aplikasi ini wajib tetap dua tema (Telegram bisa memaksa tema terang).
- **Hijau/merah PnL di mana-mana.** Credit di sini tidak pernah turun; merah tidak
  bermakna. Hijau hanya untuk penambahan nyata, jangan disebar sebagai dekorasi.
- **Presisi angka gaya trader** (`$411,127.37`). Rupiah di sini bernilai kecil;
  presisi berlebihan membuat nilainya terasa remeh. Pertahankan format lokal
  yang sudah ada di `shared/lib/format.ts`.
- **Nav pill icon-only.** Lihat 0.1.
- **Ikon emoji sebagai ikon UI.** Tetap pakai `shared/components/glyph.tsx`.

### 0.3 Kontrak teknis yang tidak boleh dilanggar

- **Tailwind v4.** Tidak ada `tailwind.config`. Token hidup di `app/globals.css`
  di dalam `@theme` dan blok `:root` / `.dark`. Utility kustom ada di dalam
  `@layer utilities`.
- **Warna wajib lewat token.** Dilarang `bg-white`, `text-black`, `bg-zinc-900`,
  atau hex mentah di JSX. Gunakan `bg-background`, `text-foreground`, `bg-card`,
  `text-muted-foreground`, `bg-primary`, `text-success`, dan sejenisnya.
- **Dua tema wajib jalan.** Setiap nilai baru harus punya pasangan di `:root`
  **dan** `.dark`. Uji keduanya.
- **Lebar acuan 384 px.** Ini viewport target. Jangan pernah menyebabkan
  overflow horizontal pada 384 px.
- **Bahasa UI: Indonesia.** Semua teks tampak pengguna berbahasa Indonesia
  ("Peringkat", "Baca selengkapnya", "Disematkan"). Nama kode/varian boleh Inggris.
- **`prefers-reduced-motion` dihormati.** Ikuti pola yang sudah ada di `globals.css`.
- **Aksesibilitas.** Target sentuh minimal 44 px, `focus-ring` tetap ada,
  `aria-*` dipertahankan, elemen dekoratif diberi `aria-hidden`.

### 0.4 Token & utility yang SUDAH ADA (pakai ini, jangan bikin duplikat)

Warna: `--background --foreground --card --primary --primary-hover --primary-active
--primary-foreground --muted --muted-foreground --border --ring --success
--destructive --premium --star --scrim`

Bentuk & ukuran: `--radius (0.875rem) --radius-md --radius-lg --radius-bubble
--cta-radius (1.125rem) --control-h (3.25rem) --cta-h --glyph-md (1.125rem)
--content-px (1rem)`

Jarak: `--block-gap --content-gap --region-gap --stack-gap --label-gap --cta-gap
--header-gap --panel-gap --surface-p --list-row-py`

Utility relevan: `.btn-glass .btn-glass-quiet .tap-plate .btn-soft
.rounded-cta .control-h .cta-h .cta-sheen
.press-scale .press-scale-soft .focus-ring .focus-ring-strong .transition-ui
.ring-border .stat-tile .task-card .px-content .bleed-x .glyph-md`

Komponen relevan: `shared/components/action-button.tsx`, `tap-action.tsx`,
`credit-amount.tsx`, `segmented-tabs.tsx`, `meta-badge.tsx`, `data-list.tsx`,
`surface.tsx`, `section-label.tsx`, `total-summary.tsx`, `glyph.tsx` (22 glyph),
`icon-circle.tsx`, `page-header.tsx`, `page-region.tsx`, `empty-state.tsx`.

> **Prinsip:** ini pengetatan, bukan penulisan ulang. Sebelum membuat komponen baru,
> cari dulu apakah sudah ada yang bisa diberi varian. Palet `--primary` (`#635bff`
> terang / `#918bff` gelap) sudah praktis identik dengan indigo fomo — **jangan
> diubah**.

### 0.5 Definisi selesai (per langkah)

Sebuah langkah baru boleh dicentang jika **semua** ini benar:

- [ ] `pnpm build` (atau perintah build di `package.json`) lolos tanpa error baru.
- [ ] Tidak ada error TypeScript baru.
- [ ] Diperiksa pada 384 px, **tema terang dan gelap**, tanpa overflow horizontal.
- [ ] Zona terlarang (0.1) tidak tersentuh — verifikasi dengan `git diff --name-only`.
- [ ] Tidak ada warna hex/utility mentah yang lolos ke JSX.
- [ ] Ceklis di file ini diperbarui, lalu commit.

---

## BAB 1 — Anatomi Gaya fomo (spesifikasi visual)

Diturunkan dari tangkapan layar rujukan. Angka di sini adalah target, bukan
hasil ukur piksel mati — utamakan konsistensi internal.

### 1.1 Tombol (paling penting)

Ciri tombol fomo:
- Radius besar dan lembut, mendekati "squircle" (~`1.25rem` pada tinggi ~3.5rem).
- Teks sangat berat (700–800), ukuran ~1.0625rem, tracking sedikit negatif.
- **Hairline "gelas", BUKAN neobrutalism.** Ini koreksi penting: tombol fomo
  adalah tombol biasa dengan bidang warna solid. Yang membuatnya khas adalah
  garis hairline 1px di dalam **seluruh** sisi ditambah kilau sedikit lebih
  terang di sisi atas — terbaca seperti permukaan kaca. **Tidak ada** bayangan
  offset padat, **tidak ada** border tebal, **tidak ada** kesan "pelat".
- Bayangan luarnya sangat kecil dan lembut (offset ~1px, blur ~2px), hanya untuk
  mengangkat tombol tipis dari latar.
- Saat ditekan: tombol menyusut halus dan kilau atasnya meredup; tombol tidak
  turun seperti pelat.
- Varian putih pekat (Apple) dan gelap-berbingkai (Google) untuk tombol sekunder.

Terjemahan ke sistem ini: `.tap-plate` sudah setengah jalan (kilau inset atas
sudah ada) tetapi hairline-nya belum melingkupi seluruh sisi. Perlu utility baru
`.btn-glass` dengan ring hairline inset + kilau atas + bayangan sangat lembut,
dipakai oleh `ActionButton` varian primer.

### 1.2 Angka besar

- Bagian utama sangat besar & berat (~3rem, weight 800), warna `foreground`.
- **Desimal & simbol satuan diredam** ke `muted-foreground` dengan ukuran
  lebih kecil (~60% dari bagian utama).
- Baris pendukung di bawahnya kecil (~0.875rem) dan redam: `+$0 24h`.
- Selalu `tabular-nums` + `tracking-tight`.

### 1.3 Kartu & permukaan

- `bg-card` dengan radius besar (~1.25rem), tanpa garis tepi mencolok
  (di gelap: `card` sedikit lebih terang dari `background`, itu sudah cukup).
- Padding lega (~0.875–1rem).
- Kartu "diri sendiri" dibedakan lewat permukaan terangkat + ring halus,
  bukan lewat warna aksen.

### 1.4 Rail horizontal

- Kartu berjajar, lebar tetap (~9.5rem), jarak ~0.75rem.
- `overflow-x-auto` + `scroll-snap-type: x mandatory` + `snap-start`.
- Scrollbar disembunyikan.
- Menembus padding halaman (`bleed-x` yang sudah ada) agar kartu terpotong
  di tepi kanan — memberi isyarat "masih ada lagi".

### 1.5 Chip & badge

- Persegi dengan radius kecil (~0.5rem), padding ketat.
- Teks ~0.6875rem, weight 700, tracking rapat.
- Latar tinted transparan (`color-mix` dari warna nada), teks warna nada penuh.
- Nada: netral (`muted`), primer, sukses, destruktif, premium.

### 1.6 Baris daftar

- Avatar 2.5rem (rail: 2rem) → nama (weight 700) + `@handle` redam → nilai kanan
  (weight 700, `tabular-nums`).
- Di bawah nilai: avatar bertumpuk (ring warna `background`, saling tumpuk
  ~0.5rem) + penghitung sisa dalam lingkaran `muted`.
- 3 teratas: medali pita (bukan angka), sisanya angka biasa + titik.

### 1.7 Feed bergaya thread

- Kolom kiri sempit berisi avatar, lalu **garis penghubung berbentuk L**
  (border-left + border-bottom dengan radius sudut) menuju isi.
- Baris atas: nama (berat) + chip jenis + waktu relatif redam.
- Isi dipotong pada N baris, lalu tautan "Baca selengkapnya" berwarna primer.
- Kaki: tombol suka + jumlah, redam.
- Antar item: pemisah tipis `border`, bukan kartu terpisah.

### 1.8 Typeface

fomo memakai grotesk geometrik sangat berat. Padanan gratis terdekat:
**Plus Jakarta Sans** (juga kebetulan buatan Indonesia, cocok untuk produk ini).
Alternatif: Manrope, Figtree.

Keputusan: heading + angka pakai font baru; body tetap tumpukan sistem agar
cepat dan familiar di dalam Telegram.

---

## BAB 2 — Peta Perubahan

### 2.1 Berkas yang akan disentuh

| Berkas | Tindakan | Langkah |
| --- | --- | --- |
| `app/globals.css` | Tambah token + utility baru | 1, 2 |
| `app/layout.tsx` | Muat font display | 2 |
| `shared/components/action-button.tsx` | Hairline gelas | 3 |
| `shared/components/credit-amount.tsx` | Mode display + desimal redam | 4 |
| `features/home/balance-summary.tsx` | Pakai mode display | 4 |
| `shared/components/meta-badge.tsx` | Chip padat + nada | 5 |
| `shared/components/segmented-tabs.tsx` | Varian polos | 6 |
| `shared/components/card-rail.tsx` | **BARU** | 7 |
| `shared/components/avatar-stack.tsx` | **BARU** | 8 |
| `shared/components/rank-medal.tsx` | **BARU** | 8 |
| `features/leaderboard/leaderboard.tsx` | Kartu diri + medali + rail | 9 |
| `features/activity/activity-feed.tsx` | Tata letak thread | 10 |
| `shared/components/pinned-notice.tsx` | **BARU** | 10 |
| `docs/keputusan-desain.md` | Catat keputusan | 11 |

### 2.2 Token baru yang akan ditambahkan

Semua wajib punya pasangan terang & gelap.

```
--hairline-edge       /* warna hairline 1px di seluruh sisi tombol */
--hairline-sheen      /* warna kilau inset di sisi atas */
--btn-shadow          /* warna bayangan luar tombol yang sangat lembut */
--rail-card-w         /* lebar kartu rail, mis. 9.5rem */
--rail-gap            /* jarak antar kartu rail */
--chip-radius         /* radius chip, mis. 0.5rem */
--thread-line         /* warna garis penghubung feed */
--font-display        /* font heading & angka */
```

### 2.3 Utility baru yang akan ditambahkan

```
.btn-glass         /* hairline seluruh sisi + kilau atas (tombol primer) */
.btn-glass-quiet   /* versi sekunder di atas bg-card, hairline pakai --border */
.num-display       /* angka besar: font-display, weight 800, tabular, tracking-tight */
.chip              /* dasar chip padat */
.rail              /* wadah scroll-snap horizontal */
.rail-item         /* item rail lebar tetap + snap-start */
.no-scrollbar      /* sembunyikan scrollbar */
.thread-line       /* garis penghubung L pada feed */
.clamp-3           /* potong 3 baris */
```

---

## BAB 3 — CEKLIS PENGERJAAN

Kerjakan berurutan. Jangan lompat. Setelah setiap langkah, jalankan
**Definisi Selesai (0.5)**, centang, lalu commit.

Format commit yang disarankan: `style(fomo): <langkah N> <ringkasan>`

---

### Langkah 1 — Fondasi token & utility

**Berkas:** `app/globals.css`

- [x] Tambah token dari 2.2 ke `:root`, dengan pasangan di `.dark`.
      Di tema gelap hairline lebih redup, bayangan lebih pekat.
- [x] Tambah `.btn-glass`: ring hairline 1px inset di seluruh sisi, kilau inset
      di sisi atas, bayangan luar sangat lembut, transisi `transform` +
      `box-shadow`. Pada `:active`, menyusut halus dan kilau atas meredup.
- [x] Tambah `.btn-glass-quiet` untuk tombol sekunder di atas `bg-card`
      (hairline memakai `--border`, kilau atas jauh lebih tipis).
- [x] Tambah `.chip`, `.rail`, `.rail-item`, `.no-scrollbar`, `.clamp-3`,
      `.thread-line`, `.num-display`.
- [x] Bungkus efek tekan (menyusut) dalam penjagaan `prefers-reduced-motion`
      (ikuti pola yang sudah ada di berkas ini).
- [x] Naikkan `--cta-radius` dari `1.125rem` → `1.25rem` agar lebih dekat ke fomo.
- [x] **Verifikasi:** tidak ada perubahan pada `.nav-pill*`, `.island*`,
      `--nav-pill-*`, `--island-*`, `.pb-nav-inset`.

**Catatan:** langkah ini belum mengubah tampilan apa pun secara mencolok.
Itu memang tujuannya — fondasi dulu.

**Status:** SELESAI. `pnpm build` lolos, tanpa error TypeScript baru, diperiksa
pada 384 px di tema terang & gelap (`scrollWidth === clientWidth === 384`),
`git diff --name-only` hanya menyentuh `app/globals.css` + dokumen ini.

---

### Langkah 2 — Typeface display

**Berkas:** `app/layout.tsx`, `app/globals.css`

- [x] Muat **Plus Jakarta Sans** lewat `next/font/google`, subset `latin`,
      bobot 700 & 800, dengan `variable: '--font-display'`.
- [x] Terapkan variabel font pada elemen `<html>` (jangan hapus kelas
      `bg-background` yang sudah ada di sana).
- [x] Di `globals.css`, set `--font-display` untuk memakai variabel tersebut
      dengan fallback ke `var(--font-sans)`.
- [x] Daftarkan sebagai utility yang bisa dipakai (`font-display`) melalui
      `@theme`, mengikuti cara `--font-sans` / `--font-mono` didaftarkan.
- [x] **Jangan** mengubah `--font-sans`. Body tetap tumpukan sistem.
- [x] Terapkan `font-display` pada `shared/components/page-header.tsx` dan
      `section-label.tsx` saja untuk langkah ini.
- [x] Cek: tidak ada pergeseran tata letak (CLS) yang kentara saat font dimuat.

**Status:** SELESAI. `pnpm build` lolos, tanpa error TypeScript baru, CLS terukur
`0` pada 384 px di tema terang & gelap (`scrollWidth === clientWidth === 384`).
`document.fonts` mengonfirmasi "Plus Jakarta Sans" 700 termuat; bobot 800 masih
`unloaded` karena belum ada pemakai (`.num-display` baru dipakai pada Langkah 4).
`git diff --name-only`: `app/globals.css`, `app/layout.tsx`,
`shared/components/page-header.tsx`, `shared/components/section-label.tsx`.

---

### Langkah 3 — ActionButton hairline gelas

**Berkas:** `shared/components/action-button.tsx`

- [x] Ganti `.tap-plate` dengan `.btn-glass` pada varian primer.
- [x] Varian sekunder/netral pakai `.btn-glass-quiet` (menggantikan `.btn-soft`
      **hanya** di komponen ini; `.btn-soft` tetap ada di CSS karena masih
      dipakai `features/home/balance-summary.tsx`, `features/channel/channel-card.tsx`,
      dan `features/profile/profile.tsx`).
- [x] Naikkan berat teks ke 700–800, tambah `tracking-tight`, ukuran ~1.0625rem.
- [x] Varian destruktif & premium: tidak ada — `ActionButton` hanya punya
      `primary` / `quiet` / `ghost`. Nada destruktif & premium di aplikasi ini
      dipakai pada chip/teks, bukan tombol, jadi tidak ada yang perlu disamakan.
- [x] Pertahankan seluruh prop, `focus-ring`, status `disabled`, dan status
      memuat yang sudah ada. **Jangan ubah antarmuka prop.**
- [x] Periksa semua pemakaian `ActionButton` masih tampil benar — khususnya
      `features/withdraw/**`, `features/premium/**`, `features/ads/**`.
- [x] Cek target sentuh tetap ≥ 44 px (`.control-h` = `3.25rem` = 52 px).

**Status:** SELESAI. Gaya tombol dikoreksi dari "pelat neobrutal" menjadi
hairline gelas: `--plate-*` diganti `--hairline-edge` / `--hairline-sheen` /
`--btn-shadow`, dan `.plate-3d` / `.plate-3d-soft` diganti `.btn-glass` /
`.btn-glass-quiet`. `pnpm build` lolos, tanpa error TypeScript baru, diperiksa
pada 384 px di tema terang & gelap tanpa overflow horizontal.

---

### Langkah 4 — Angka besar bergaya fomo

**Berkas:** `shared/components/credit-amount.tsx`, `features/home/balance-summary.tsx`

- [x] Tambah ukuran/mode baru pada `CreditAmount` (mis. `size="display"`)
      yang: memakai `.num-display`, membelah hasil format sehingga
      **bagian desimal dan simbol satuan** dirender dalam `span` terpisah
      ber-`text-muted-foreground` dan ~60% ukuran.
- [x] Pembelahan harus aman untuk format Indonesia (`Rp1.234,56` — pemisah
      ribuan titik, desimal koma). **Jangan** mengasumsikan format Inggris.
      Gunakan helper yang ada di `shared/lib/format.ts`; jika perlu, tambahkan
      helper pembelah di sana dan uji lewat `format.test.ts`.
- [x] Jika nilainya bulat tanpa desimal, jangan paksa memunculkan `,00` —
      cukup redam simbol satuan.
- [x] Terapkan di `balance-summary.tsx`, dengan baris pendukung kecil & redam
      di bawahnya (mengikuti pola `+$0 24h` fomo, tapi berbahasa Indonesia,
      mis. "+Rp0 hari ini").
- [x] Pastikan `use-count-up.ts` masih bekerja dengan mode baru ini.
- [x] Mode/ukuran lama **tidak boleh berubah perilakunya**.

**Status:** SELESAI. `CreditAmount` dapat `size="display"` yang memakai
`.num-display` dan membelah nilai lewat `splitAmountParts()` baru di
`shared/lib/format.ts` — pembelahan bekerja pada string hasil format `id-ID`
(bukan pada angka), sehingga titik ribuan tidak pernah salah dibaca sebagai
desimal; bilangan bulat tidak mendapat `,00` paksaan karena bagian `trail`
cuma kosong. Ukuran `sm` / `xl` / `2xl` tidak disentuh.

Baris pendukung di `balance-summary.tsx` sekarang "Rp900 · +9 hari ini".
Angka "hari ini" dijumlahkan dari `history` yang sudah ada di `home.tsx` (tidak
ada sumber data baru) dan memakai `isSameWibDay()` — juga baru di `format.ts` —
supaya definisi "hari ini" sama dengan label waktu riwayat, bukan mengikuti
zona perangkat. Nada hijau hanya muncul kalau tambahannya benar-benar > 0.

Diverifikasi: `pnpm vitest run` 382 tes lolos (termasuk 5 tes baru untuk
`splitAmountParts`), `tsc --noEmit` bersih, dan warna hasil render diperiksa
langsung di browser pada 384 px tema gelap — bagian utama `#f4f4f5`, satuan
`#a1a1aa` pada 0.6em.

---

### Langkah 5 — Chip padat

**Berkas:** `shared/components/meta-badge.tsx`

- [x] Terapkan `.chip` sebagai dasar: radius `--chip-radius`, padding ketat,
      teks 0.6875rem weight 700.
- [x] Nada latar tinted dari warna nada memakai `color-mix` (ikuti pola
      `color-mix` yang sudah dipakai di `globals.css`).
- [x] Pastikan kontras teks memadai di **kedua** tema (ini titik paling rawan
      gagal — nada premium & sukses di tema terang perlu diperiksa cermat).
- [x] Periksa seluruh pemakaian `MetaBadge`, termasuk
      `features/captcha/components/difficulty-badge.tsx` bila ia memakainya.

**Status:** SELESAI. `BADGE_SHAPE` (`px-1.5 py-1 text-[11px] rounded-md`) diganti
`CHIP_SHAPE` = utility `.chip`, dan `tone` `MetaBadge` diperluas dari
`muted | accent` menjadi `muted | neutral | primary | success | destructive |
premium` dengan kelas nada `.chip-*` di `globals.css`.

Kontras adalah titik yang paling banyak menyita pekerjaan di langkah ini, dan
ternyata memang gagal kalau token nada dipakai apa adanya: `--success`,
`--destructive`, dan `--premium` versi terang dibuat untuk ikon/teks besar,
terlalu muda untuk teks 11px. Karena itu ditambahkan token `--chip-fg-*`
terpisah — di tema terang memakai varian yang lebih pekat
(`#166534` / `#b91c1c` / `#92400e` / `--primary-active`), di tema gelap memakai
token nada langsung karena di sana sudah cukup terang. Tint-nya juga tidak sama
antar tema (`--chip-tint` 12% terang / 18% gelap) supaya latar chip tetap
terbaca di atas `#101014`.

Satu temuan tak terduga: kombinasi lama `--muted-foreground` di atas `--muted`
cuma **4.40:1** — di bawah 4.5:1 untuk teks kecil. Diperbaiki lewat
`--chip-fg-muted` (`#52525b`) yang khusus chip, jadi `--muted-foreground` yang
dipakai seluruh aplikasi tidak ikut bergeser.

Rasio kontras terukur langsung di browser (chip di atas `--background` **dan**
`--card`, alpha dikomposit dulu): terang 4.54–14.13, gelap 6.10–17.48 — semua
lolos AA teks kecil. `pnpm lint` bersih, `tsc --noEmit` bersih, `pnpm build`
lolos, `scrollWidth === clientWidth === 384`.

Pemakaian yang ikut disesuaikan: `tone="accent"` → `tone="primary"` di
`leaderboard.tsx` (chip "Kamu") dan `activity-feed.tsx` (chip "Cair"); `CHIP_TONE`
lokal di `leaderboard.tsx` yang tadinya string kelas mentah (`bg-primary/10`,
`bg-success/10`) sekarang memetakan `PrestigeKey` → `ChipTone` dan merender lewat
`MetaBadge`, sehingga tidak ada lagi utility warna mentah di JSX itu — nada
`premium` yang tadinya string kosong kini terisi. `difficulty-badge.tsx` memakai
`CHIP_SHAPE` + `.chip-muted` (gap 1.5 dipertahankan untuk meter-nya). Tinggi chip
berubah 24px → 20px, jadi bar kerangka `DataListSkeleton` disesuaikan ke `h-5`
+ radius `--chip-radius` agar tidak melompat saat data masuk.

Catatan: chip "Cair" sengaja **tidak** dijadikan hijau meski nada `success`
tersedia — aturan 0.2 melarang hijau sebagai dekorasi, dan penarikan yang cair
bukan penambahan credit.

---

### Langkah 6 — Segmented polos + chip filter

**Berkas:** `shared/components/segmented-tabs.tsx`

- [x] Tambah varian `plain`: tanpa wadah berlatar, item tak aktif hanya teks
      redam, item aktif berupa pill `bg-muted` dengan teks `foreground`.
- [x] Varian yang sudah ada tetap utuh (dipakai di tempat lain).
- [x] Sediakan komponen/gaya chip dropdown "Semua ⌄" — pill `bg-card`
      berukuran kecil dengan glyph chevron dari `glyph.tsx`.
- [x] Pertahankan navigasi papan tombol dan `aria-*` yang sudah ada.

**Status:** SELESAI. `SegmentedTabs` dapat prop `variant?: 'solid' | 'plain'`
(default `solid`, jadi `features/stats`, `features/history`, dan
`features/leaderboard` tidak berubah satu piksel pun). Varian `plain` melepas
wadah `bg-muted` + `p-1`, melepas `flex-1` (supaya lebarnya mengikuti isi dan
bisa berdampingan dengan chip filter di satu baris), dan menandai tab aktif
sebagai pill `bg-muted` `rounded-full`. `role="tablist"` / `aria-selected` /
`aria-controls` dan `hapticSelect()` tetap sama untuk kedua varian.

`FilterChip` ditambahkan di berkas yang sama. Pemilihnya `<select>` asli yang
ditumpuk transparan di atas chip, bukan popover buatan sendiri — papan tombol,
pembaca layar, dan pemilih bawaan OS/Telegram langsung bekerja tanpa manajemen
fokus manual. Karena `<select>`-nya transparan, cincin fokus dipindahkan ke chip
lewat `has-[select:focus-visible]`.

Belum dipasang ke halaman mana pun; pemasangan adalah Langkah 9.

Diverifikasi lewat halaman percobaan sementara (sudah dihapus) pada 384 px:
`scrollWidth === clientWidth === 384` di tema terang **dan** gelap, chip tinggi
32 px tetapi area sentuh `<select>` terukur **44 px** (overlay `-inset-y-1.5`),
dan mengganti pilihan benar-benar memperbarui label chip. `pnpm lint` bersih,
`tsc --noEmit` bersih, `pnpm build` lolos. `git diff --name-only`:
`shared/components/segmented-tabs.tsx` + dokumen ini — zona terlarang tidak
tersentuh.

---

### Langkah 7 — Rail kartu horizontal

**Berkas baru:** `shared/components/card-rail.tsx`

- [x] Buat `CardRail` + `CardRailItem` memakai `.rail` / `.rail-item`.
- [x] Gunakan `.bleed-x` yang sudah ada agar rail menembus padding halaman
      dan kartu terpotong di tepi kanan.
- [x] Sembunyikan scrollbar, aktifkan scroll-snap, pertahankan gulir dengan
      papan tombol (`overflow-x-auto` sudah memberi ini secara alami —
      pastikan `tabIndex` tidak dirusak).
- [x] Sediakan status kosong lewat `empty-state.tsx` yang sudah ada.
- [x] Uji pada 384 px: tidak boleh menyebabkan halaman ikut bergulir horizontal.

**Status:** SELESAI. `CardRail` merender `<ul class="rail no-scrollbar bleed-x">`
dan `CardRailItem` merender `<li class="rail-item">` — komponennya tidak
menambah CSS baru, hanya mengunci urutan keempat utilitas Langkah 1 supaya tidak
pernah dipasang separuh. `role="list"` disetel eksplisit karena `list-style:
none` dari preflight menghapus semantik daftar di Safari/VoiceOver.

`tabIndex` sengaja tidak disetel sama sekali: `tabIndex={0}` pada wadahnya hanya
menambah perhentian fokus yang tidak mengumumkan apa pun, dan `tabIndex={-1}`
akan mematikan gulir bawaan. Status kosong lewat prop `empty` dan dirender
**tanpa** `.bleed-x`, karena blok terpusat harus tetap di dalam padding halaman;
`Children.count === 0` juga menganggap kartu bersyarat yang bernilai `null`
sebagai kosong.

Belum dipasang ke halaman mana pun; pemasangan adalah Langkah 9.

Diverifikasi lewat halaman percobaan sementara (sudah dihapus) pada 384 px:
`document.scrollWidth === clientWidth === 384` walau `rail.scrollWidth = 676`
(rail yang bergulir, bukan halaman), tepi kiri rail di `0` dengan kartu pertama
di `16` (bleed bekerja), kartu ketiga terpotong di tepi kanan, `scrollLeft = 60`
kembali ke `0` (scroll-snap aktif), `scrollbar-width: none`, padding akhir tetap
utuh (`scrollLeft` maksimum `292` = `676 − 384`), dan memfokuskan tombol di
kartu terakhir menggulirkan rail `0 → 292` sendiri (gulir papan tombol utuh).
Status kosong tampil benar. `tsc --noEmit` bersih, `pnpm lint` bersih,
`pnpm build` lolos. `git diff --name-only`:
`shared/components/card-rail.tsx` (baru) + dokumen ini — zona terlarang tidak
tersentuh.

---

### Langkah 8 — Avatar bertumpuk & medali

**Berkas baru:** `shared/components/avatar-stack.tsx`, `shared/components/rank-medal.tsx`

- [x] `AvatarStack`: terima daftar avatar + batas tampil, saling tumpuk dengan
      ring warna `background`, sisanya jadi lingkaran `bg-muted` berisi `N+`.
- [x] Beri `aria-label` yang bermakna; avatar individual `aria-hidden`.
- [x] `RankMedal`: pita untuk peringkat 1–3 (emas/perak/bronze diturunkan dari
      token — gunakan `--premium` untuk emas, dan tambahkan token bila perlu
      untuk perak/bronze; keduanya wajib punya pasangan gelap).
- [x] Peringkat > 3 dirender sebagai angka biasa, bukan medali.
- [x] Kedua komponen harus aman ketika daftar avatar kosong / gambar gagal muat.

**Status:** SELESAI. `RankMedal` merender pita (`clip-path` bercelah "V" di sisi
bawah) untuk peringkat 1–3 dan `12.` / `–` untuk sisanya; apa pun di luar 1–3 —
termasuk `0`, negatif, dan `NaN` — jatuh ke cabang angka, jadi tidak ada pita
tanpa warna. Ukuran `sm` / `md` disediakan karena lencana ini akan dipasang di
lingkaran kecil pada baris papan (Langkah 9).

Emas **tidak** memakai `--premium` seperti tertulis di rencana — lihat catatan
penyimpangan di BAB 4. Token baru `--medal-gold/-silver/-bronze` plus pasangan
`-fg`-nya ditambahkan di kedua tema dan didaftarkan di `@theme inline`, sehingga
JSX cuma memakai `bg-medal-*` / `text-medal-*-fg` tanpa hex mentah.

`AvatarStack` menumpuk avatar dengan margin negatif (bukan `translate`, supaya
lebar total ikut mengecil dan baris di sebelahnya tidak perlu tahu jumlah
avatarnya), memberi ring `background` — atau `card` lewat `ringTone` untuk
pemakaian di dalam kartu — dan meringkas sisanya jadi `65+` di lingkaran
`bg-muted`. Daftar kosong mengembalikan `null` alih-alih meninggalkan wadah
ber-`aria-label` yang tidak mengumumkan apa pun.

Diverifikasi lewat halaman percobaan sementara (sudah dihapus) pada 384 px:
`scrollWidth === clientWidth === 384` di tema terang **dan** gelap; rasio
kontras angka di atas pitanya diukur langsung di browser — terang
7.36 / 9.18 / 6.75, gelap 11.14 / 11.55 / 5.67, semua lolos AA teks kecil;
ring avatar terukur tepat `#fafafa` (terang) dan `#101014` (gelap); dan saat
`error` gambar dipicu, ketiga `img` benar-benar berganti ke glyph pengganti
(`imgs: 3 → 0`, `svg: 8`). `tsc --noEmit` bersih, `pnpm lint` bersih,
`pnpm build` lolos. `git diff --name-only`: `app/globals.css`,
`shared/components/avatar-stack.tsx`, `shared/components/rank-medal.tsx` +
dokumen ini — zona terlarang tidak tersentuh.

Belum dipasang ke halaman mana pun; pemasangan adalah Langkah 9. `MEDAL_CLASS`
berisi hex mentah di `features/leaderboard/leaderboard.tsx` sengaja dibiarkan
untuk sementara — ia baru boleh dicabut saat `RankMedal` menggantikannya di
Langkah 9, bukan sekarang.

**Sudah dilakukan di Langkah 9:** `MEDAL_CLASS` dicabut, dan prop `halo` yang
tertinggal tanpa render di langkah ini ikut diperbaiki. Lihat BAB 4.

---

### Langkah 9 — Halaman Peringkat

**Berkas:** `features/leaderboard/leaderboard.tsx`

- [x] Ubah blok "posisi kamu" menjadi **kartu tersorot**: `bg-card`, radius
      besar, avatar + nama + `@handle • Kamu` + nilai di kanan.
      → Pakai `.task-card` (Langkah 1) yang sudah tepat `bg-card` + radius besar.
      `@handle` **dilewati**: tidak ada kolomnya di `LeaderboardEntry`. Lihat BAB 4.
- [x] Pakai varian segmented `plain` untuk rentang waktu, dan chip dropdown
      untuk filter di kiri (mengikuti tata letak fomo: filter kiri, waktu kanan).
      → `FilterChip` untuk Semua/VIP; `plain` dipakai untuk tab Papan/Aktivitas
      karena papan ini tidak punya rentang waktu. Lihat BAB 4.
- [x] Terapkan `RankMedal` untuk 3 teratas.
- [x] Terapkan `AvatarStack` pada baris peringkat bila datanya tersedia; jika
      tidak ada data lencana/avatar pendukung, **jangan** mengarang data —
      lewati saja bagian ini dan catat di BAB 4. → **Dilewati**, tidak ada datanya.
- [x] Terapkan `CardRail` untuk seksi ringkasan di atas (padanan "Clans"),
      **hanya jika** sudah ada data nyata untuk itu. Kalau belum ada,
      lewati dan catat. → **Dilewati**, tidak ada padanan "Clans" di app ini.
- [x] Perhatikan komentar tentang keterbatasan lebar 384 px yang sudah ada di
      berkas ini — jangan menambah tekanan lebar.
- [x] Jangan mengubah `features/leaderboard/domain.ts` atau `availability.ts`
      kecuali benar-benar perlu; ini pekerjaan presentasi.
      → Keduanya tidak disentuh.

**Status:** SELESAI. Tiga hal ditukar di `leaderboard.tsx`: tablist garis-bawah
buatan sendiri → `SegmentedTabs` varian `plain`, tab `Semua/VIP` di dalam papan →
`FilterChip`, dan lingkaran bernomor 1–3 di `BoardFrame` → `RankMedal`. Konstanta
`MEDAL_CLASS` berisi hex mentah — satu-satunya sisa hex di berkas ini — dicabut
karena `RankMedal` kini pemakai tunggal warna itu lewat token `--medal-*`.

Dua pembungkus `role="tabpanel"` (`#panel-papan`, `#panel-aktivitas`) ditambahkan
supaya `aria-controls` yang dibawa `SegmentedTabs` benar-benar menunjuk elemen
yang ada; keduanya `flex flex-1 flex-col` agar empty state (`flex-1
justify-center`) tetap terpusat seperti sebelum ada pembungkus. Baris filter
dipasang `justify-between` walau sisi kanannya kosong — lihat penyimpangan di
BAB 4 soal rentang waktu yang tidak dirender.

Diperiksa di peramban lewat halaman percobaan sementara (sudah dihapus) pada
384px, tema terang dan gelap: kartu posisi, pita medali 1/2/3 dengan kontur
`halo`, chip `Semua 6` → `VIP 2`, perpindahan tab Papan ↔ Aktivitas, dan kedua
empty state (papan kosong & aktivitas kosong) masih terpusat. Baris meta kartu
posisi awalnya terpotong (`#3 dari 1.284 peserta · 3…`) dan dipendekkan dengan
membuang hitungan task — lihat BAB 4. `tsc --noEmit` bersih.

---

### Langkah 10 — Feed & pengumuman

**Berkas:** `features/activity/activity-feed.tsx`, **baru:** `shared/components/pinned-notice.tsx`

- [ ] Ubah baris feed menjadi tata letak thread: kolom avatar + `.thread-line`
      berbentuk L menuju isi.
- [ ] Baris atas: nama berat + `MetaBadge` jenis + waktu relatif redam.
- [ ] Isi dipotong `.clamp-3` dengan tautan "Baca selengkapnya" berwarna primer
      yang membuka/menutup potongan. Tautan hanya muncul bila teks memang
      terpotong.
- [ ] Pemisah antar item berupa `border` tipis, bukan kartu terpisah.
- [ ] Buat `PinnedNotice`: kartu di pucuk feed dengan label "Disematkan",
      judul, isi terpotong, dan "Baca selengkapnya".
- [ ] Hubungkan ke sumber siaran/broadcast yang sudah ada bila tersedia.
      Jika belum ada jalur datanya, render komponen hanya saat ada isi,
      dan catat di BAB 4. **Jangan** menanam teks pengumuman palsu.
- [ ] Pertahankan semantik daftar (`ul`/`li`) dan `aria-*`.

---

### Langkah 11 — Rapikan & dokumentasikan

- [ ] Telusuri seluruh JSX untuk warna mentah yang lolos
      (`bg-white`, `text-black`, `bg-zinc-`, `text-gray-`, `#`) dan ganti
      dengan token.
- [ ] Hapus token/utility yang ternyata tidak terpakai dari yang ditambahkan
      di Langkah 1.
- [ ] Hapus semua `console.log` sisa.
- [ ] Jalankan berkas uji yang ada: `format.test.ts`, `domain.test.ts`
      (referral & withdraw), `api-client.test.ts`.
- [ ] Periksa akhir pada 384 px, terang & gelap, seluruh tampilan:
      Beranda, Peringkat, Misi, Teman, Profil, Riwayat, Tarik dana, Premium.
- [ ] Pastikan nav pill & island **tampak dan berperilaku persis seperti
      sebelum pekerjaan ini dimulai**. Bandingkan dengan `git stash` bila perlu.
- [ ] Tulis ringkasan keputusan ke `docs/keputusan-desain.md` (jangan
      menimpa isinya — tambahkan seksi baru).
- [ ] Isi BAB 4 di bawah.

---

## BAB 4 — Catatan Pelaksanaan

Diisi oleh agent selama pengerjaan. Ini penting untuk serah-terima antar agent.

### Yang dilewati dan alasannya

- **Langkah 9 — `AvatarStack` di baris papan.** Dilewati: tidak ada datanya.
  `LeaderboardEntry` cuma punya satu `photoUrl` milik peserta itu sendiri, dan
  tumpukan avatar di fomo berisi **token yang dipegang** trader — konsep yang
  tidak ada padanannya di app ini. Lencana prestise di baris papan adalah chip
  teks (`MetaBadge`), bukan avatar, jadi ia juga bukan sumber yang cocok.
  `AvatarStack` (Langkah 7) karena itu masih tanpa pemakai; jangan hapus dulu,
  Langkah 10 (feed) belum diperiksa.
- **Langkah 9 — `CardRail` untuk padanan "Clans".** Dilewati: tidak ada padanannya.
  "Clans" di fomo adalah grup yang PnL anggotanya dijumlahkan; app ini tidak punya
  entitas grup apa pun — tidak ada tabel, tidak ada relasi, tidak ada UI. Kandidat
  terdekat (statistik papan seperti jumlah peserta/premium) sudah tampil sebagai
  badge di `DataList` dan tidak butuh rail yang bisa digeser. Membuatnya berarti
  mengarang entitas, bukan cuma mengarang data.
- **Langkah 9 — `@handle` di kartu posisi.** Dilewati: `LeaderboardEntry` tidak
  punya kolom username/handle, dan `server/leaderboard.ts` tidak membacanya.
  Menambahkannya berarti mengubah domain + query, sementara langkah ini eksplisit
  "pekerjaan presentasi". Barisnya jadi `Nama` + mahkota + chip "Kamu" di atas, dan
  `#3 dari 1.284 peserta` di bawah — informasi yang sama posisinya seperti
  `@handle • You` di fomo.

### Penyimpangan dari rencana

- **Langkah 1 — selektor tema gelap.** Rencana menyebut `.dark`. Proyek ini
  sebenarnya memakai `:root[data-theme='dark']` (dipasang `shell/theme-init.ts`).
  Pasangan token gelap ditulis di selektor itu, bukan `.dark`.
- **Langkah 1 — `--font-display`.** Token sudah ditambahkan sekarang dengan
  nilai `var(--font-sans)` supaya `.num-display` tidak menunjuk variabel kosong.
  Langkah 2 hanya perlu mengarahkannya ke variabel font Plus Jakarta Sans.
  (Sudah dilakukan: lihat catatan Langkah 2 di bawah.)
- **Langkah 2 — nama variabel font.** Rencana menyebut `variable: '--font-display'`.
  Itu akan bertabrakan dengan token tema bernama sama, jadi `next/font` memakai
  `variable: '--font-plus-jakarta'`, lalu `--font-display` di `@theme inline`
  disusun sebagai `var(--font-plus-jakarta), var(--font-sans)`. Hasilnya sama
  (`font-display` tetap jadi utility), tanpa rantai `var()` melingkar.
- **Langkah 2 — deklarasi `:root` dihapus.** Placeholder `--font-display` yang
  ditambahkan di `:root` pada Langkah 1 dicabut; nilai sebenarnya kini hidup di
  `@theme inline` (yang tetap menerbitkannya ke `:root`), agar tidak ada dua
  sumber kebenaran untuk token yang sama.
- **Langkah 2 — `page-header.tsx` tanpa efek tampak.** `PageHeader` hanya
  merender `<h1 className="sr-only">`, jadi `font-display` di sana murni
  persiapan bila judul kelak ditampilkan. Efek nyata Langkah 2 datang dari
  `section-label.tsx` (`EYEBROW_CLASS`).
- **Langkah 6 — tempat `FilterChip`.** Rencana hanya menyebut satu berkas untuk
  langkah ini dan tidak menandai berkas baru, jadi chip dropdown ditaruh di
  `shared/components/segmented-tabs.tsx` (bukan berkas baru) — keduanya adalah
  kontrol pemilih pada baris yang sama dan selalu dipakai bersama.
- **Langkah 6 — dropdown pakai `<select>` asli.** Bukan popover/listbox buatan
  sendiri. Alasan: a11y & papan tombol gratis, pemilih bawaan OS lebih pas di
  dalam Telegram, dan tidak ada manajemen fokus yang bisa bentrok dengan
  `shell/telegram-viewport.ts`. Konsekuensinya `--chip-radius` tidak dipakai di
  sini: chip filter fomo berbentuk pill penuh (`rounded-full`), sedangkan
  `--chip-radius` milik badge persegi Langkah 5.
- **Langkah 8 — emas medali bukan `--premium`.** Rencana menyebut `--premium`
  untuk emas. Ditolak: premium sudah memakai emas di cincin avatar dan mahkota
  di baris papan yang sama, dan komentar di `leaderboard.tsx` sudah menyatakan
  bahwa emas medali "tidak bertabrakan dengan emas premium" justru karena
  keduanya hidup di tempat berbeda. Memakai satu token untuk dua arti akan
  membatalkan itu. Selain itu `--premium` versi terang (`#b45309`) coklat, bukan
  emas. Jadi `--medal-gold/-silver/-bronze` berdiri sendiri, nilainya diambil
  dari `MEDAL_CLASS` yang sudah ada supaya podium tidak berubah warna, kecuali
  perunggu terang yang dipekatkan (`#b06a3b` → `#8a4b21`) karena teks putih di
  atas nilai lama hanya ~4.2:1.
- **Langkah 8 — `aria-hidden` per avatar tidak dipasang.** Wadah `AvatarStack`
  memakai `role="img"` + `aria-label`, yang sudah membuat seluruh subtree-nya
  presentasional; menambah `aria-hidden` per avatar tidak mengubah apa pun dan
  `ProfileAvatar` juga tidak menerima prop itu (ia sudah merender `alt=""`).
  Penghitung sisa tetap `aria-hidden` eksplisit.
- **Langkah 8 — `AvatarStack` memakai `ProfileAvatar` dari `features/home`.**
  Impor `shared/` → `features/` bukan arah yang ideal, tapi menulis ulang
  penanganan `onError` → glyph pengganti di komponen kedua lebih buruk: dua
  jalur fallback yang bisa berbeda diam-diam. Presedennya sudah ada
  (`shared/lib/shape-path.ts` mengimpor tipe dari `features/captcha`). Kalau
  nanti ada fitur ketiga yang butuh avatar, `ProfileAvatar` layak dipindahkan
  ke `shared/components/` — itu pekerjaan terpisah, bukan bagian langkah ini.
- **Langkah 9 — varian `plain` dipakai untuk tab Papan/Aktivitas, bukan rentang
  waktu.** Rencana menugaskan `plain` ke pemilih rentang waktu. Papan ini
  kumulatif: `getLeaderboard` tidak menerima parameter waktu dan tidak ada kolom
  bertanggal yang bisa disaring, jadi pill "24j / 7h / 30h" akan jadi kontrol
  yang tidak menyaring apa pun. `plain` dialihkan ke pemilih yang memang ada dan
  memang tablist — Papan ↔ Aktivitas, yang sebelumnya tablist garis-bawah
  buatan sendiri di berkas ini. Baris filternya tetap `justify-between` agar
  pemilih waktu bisa masuk di kanan tanpa menyusun ulang baris itu kalau jalur
  datanya kelak ada.
- **Langkah 9 — `FilterChip` untuk Semua/VIP, bukan untuk kategori baru.**
  Rencana menyebut chip dropdown "untuk filter di kiri" tanpa menyebut isinya.
  Yang dipasang adalah saringan yang sudah hidup di berkas ini (`Semua N` /
  `VIP N`), yang sebelumnya berbentuk tab kedua. Konsekuensinya pembungkus
  daftarnya kehilangan `role="tabpanel"`: pemilihnya kini `<select>`, jadi
  `aria-labelledby="tab-…"` akan menunjuk id yang tidak ada. Labelnya tidak
  hilang — `DataList` sudah membawa `<section aria-label>` sendiri.
- **Langkah 9 — angka biasa `RankMedal` tidak dipakai di `BoardFrame`.**
  Peringkat > 3 tetap memakai lingkaran redam bernomor milik `BoardFrame`, bukan
  cabang angka `RankMedal`. Alasan: cabang itu teks tanpa bidang, dan ia
  ditumpuk di sudut foto profil yang warnanya tidak bisa ditebak. Untuk pitanya,
  masalah yang sama diurus prop `halo`.
- **Langkah 9 — prop `halo` `RankMedal` diperbaiki di sini, bukan di Langkah 8.**
  `halo` dideklarasikan di Langkah 8 tapi tidak pernah dirender. Langkah 9 adalah
  konsumen pertamanya, jadi rendernya ditulis sekarang: pita kedua sedikit lebih
  besar dengan `clip-path` yang sama, karena `ring`/`shadow` mengikuti kotak dan
  bukan siluet ber-notch.
- **Langkah 9 — hitungan task dibuang dari baris meta kartu posisi.** Rencana
  menyebut "avatar + nama + `@handle • Kamu` + nilai". Susunan itu dipertahankan,
  tapi `· N task` yang sempat ikut di baris kedua dicabut setelah terlihat
  terpotong di 384px (kolom nama tinggal ~200px setelah avatar dan nilai).
  Informasinya tidak hilang: baris papan user ini juga menampilkannya.
- **Langkah 1 — `--thread-line`.** Dijadikan alias `var(--border)` di kedua tema
  (bukan warna baru), karena `--border` sudah punya nilai terang & gelap yang
  tepat untuk garis penghubung setipis ini. Token tetap ada agar Langkah 10
  bisa menyetelnya sendiri bila ternyata perlu lebih redup.

### Ditemukan tapi di luar cakupan

- **Pita perak vs latar terang.** `--medal-silver` (`#b8bcc4`) hanya ~1.8:1
  terhadap `--background` terang, jadi bidang pitanya sendiri nyaris tidak
  berbatas di tema terang. Angka di dalamnya tetap 9.18:1 sehingga informasinya
  utuh, tapi kalau kelak medali dipakai tanpa angka (mis. ikon saja), perak
  butuh garis tepi. Tidak diubah sekarang karena akan menggeser warna podium
  yang sudah ada.

---

## BAB 5 — Untuk agent berikutnya

Jika kamu mengambil alih pekerjaan ini di tengah jalan:

1. Baca **BAB 0** seluruhnya. Zona terlarang di 0.1 bukan saran.
2. Lihat ceklis **BAB 3**, temukan kotak tak tercentang pertama, mulai dari sana.
3. Baca **BAB 4** untuk memahami keputusan agent sebelumnya.
4. Jalankan `git log --oneline` untuk melihat langkah mana yang sudah masuk.
5. Kalau ragu antara "mirip fomo" dan "tidak merusak nav pill / island":
   **pilih tidak merusak.** Selalu.
