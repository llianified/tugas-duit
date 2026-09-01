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
1. Tombol chunky berlapis (depth 3D, radius besar, teks berat).
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

Utility relevan: `.tap-plate .btn-soft .rounded-cta .control-h .cta-h .cta-sheen
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
- **Depth padat, bukan blur lembut:** garis highlight tipis di dalam sisi atas,
  lalu bayangan **padat** di bawah (offset ~3px, blur 0) — memberi kesan
  "pelat yang bisa ditekan".
- Saat ditekan: tombol turun ~2px dan bayangan bawah mengecil, bukan sekadar
  meredup atau menyusut proporsional.
- Varian putih pekat (Apple) dan gelap-berbingkai (Google) untuk tombol sekunder.

Terjemahan ke sistem ini: `.tap-plate` sudah setengah jalan (highlight inset
sudah ada) tetapi bayangannya masih blur lembut. Perlu utility baru
`.plate-3d` dengan bayangan padat + perilaku tekan-turun, dipakai oleh
`ActionButton` varian primer.

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
| `shared/components/action-button.tsx` | Varian depth 3D | 3 |
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
--plate-lift          /* jarak turun saat ditekan, mis. 2px */
--plate-shadow        /* warna bayangan padat tombol */
--plate-highlight     /* warna highlight inset atas */
--rail-card-w         /* lebar kartu rail, mis. 9.5rem */
--rail-gap            /* jarak antar kartu rail */
--chip-radius         /* radius chip, mis. 0.5rem */
--thread-line         /* warna garis penghubung feed */
--font-display        /* font heading & angka */
```

### 2.3 Utility baru yang akan ditambahkan

```
.plate-3d          /* bayangan padat + tekan-turun (tombol primer) */
.plate-3d-soft     /* versi sekunder di atas bg-card */
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
      Di tema gelap bayangan lebih pekat, highlight lebih redup.
- [x] Tambah `.plate-3d`: highlight inset atas, bayangan **padat** (blur 0)
      di bawah, transisi `transform` + `box-shadow`. Pada `:active`, geser
      turun `--plate-lift` dan kecilkan bayangan.
- [x] Tambah `.plate-3d-soft` untuk tombol sekunder di atas `bg-card`
      (bayangan lebih halus, tetap punya ring `--border`).
- [x] Tambah `.chip`, `.rail`, `.rail-item`, `.no-scrollbar`, `.clamp-3`,
      `.thread-line`, `.num-display`.
- [x] Bungkus efek tekan-turun dalam penjagaan `prefers-reduced-motion`
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

- [ ] Muat **Plus Jakarta Sans** lewat `next/font/google`, subset `latin`,
      bobot 700 & 800, dengan `variable: '--font-display'`.
- [ ] Terapkan variabel font pada elemen `<html>` (jangan hapus kelas
      `bg-background` yang sudah ada di sana).
- [ ] Di `globals.css`, set `--font-display` untuk memakai variabel tersebut
      dengan fallback ke `var(--font-sans)`.
- [ ] Daftarkan sebagai utility yang bisa dipakai (`font-display`) melalui
      `@theme`, mengikuti cara `--font-sans` / `--font-mono` didaftarkan.
- [ ] **Jangan** mengubah `--font-sans`. Body tetap tumpukan sistem.
- [ ] Terapkan `font-display` pada `shared/components/page-header.tsx` dan
      `section-label.tsx` saja untuk langkah ini.
- [ ] Cek: tidak ada pergeseran tata letak (CLS) yang kentara saat font dimuat.

---

### Langkah 3 — ActionButton chunky

**Berkas:** `shared/components/action-button.tsx`

- [ ] Ganti `.tap-plate` dengan `.plate-3d` pada varian primer.
- [ ] Varian sekunder/netral pakai `.plate-3d-soft` (menggantikan `.btn-soft`
      **hanya** di komponen ini; jangan hapus `.btn-soft` dari CSS karena
      mungkin dipakai di tempat lain — cek dulu dengan pencarian).
- [ ] Naikkan berat teks ke 700–800, tambah `tracking-tight`, ukuran ~1.0625rem.
- [ ] Pastikan varian destruktif & premium ikut mendapat depth yang sama.
- [ ] Pertahankan seluruh prop, `focus-ring`, status `disabled`, dan status
      memuat yang sudah ada. **Jangan ubah antarmuka prop.**
- [ ] Periksa semua pemakaian `ActionButton` masih tampil benar — khususnya
      `features/withdraw/**`, `features/premium/**`, `features/ads/**`.
- [ ] Cek target sentuh tetap ≥ 44 px.

---

### Langkah 4 — Angka besar bergaya fomo

**Berkas:** `shared/components/credit-amount.tsx`, `features/home/balance-summary.tsx`

- [ ] Tambah ukuran/mode baru pada `CreditAmount` (mis. `size="display"`)
      yang: memakai `.num-display`, membelah hasil format sehingga
      **bagian desimal dan simbol satuan** dirender dalam `span` terpisah
      ber-`text-muted-foreground` dan ~60% ukuran.
- [ ] Pembelahan harus aman untuk format Indonesia (`Rp1.234,56` — pemisah
      ribuan titik, desimal koma). **Jangan** mengasumsikan format Inggris.
      Gunakan helper yang ada di `shared/lib/format.ts`; jika perlu, tambahkan
      helper pembelah di sana dan uji lewat `format.test.ts`.
- [ ] Jika nilainya bulat tanpa desimal, jangan paksa memunculkan `,00` —
      cukup redam simbol satuan.
- [ ] Terapkan di `balance-summary.tsx`, dengan baris pendukung kecil & redam
      di bawahnya (mengikuti pola `+$0 24h` fomo, tapi berbahasa Indonesia,
      mis. "+Rp0 hari ini").
- [ ] Pastikan `use-count-up.ts` masih bekerja dengan mode baru ini.
- [ ] Mode/ukuran lama **tidak boleh berubah perilakunya**.

---

### Langkah 5 — Chip padat

**Berkas:** `shared/components/meta-badge.tsx`

- [ ] Terapkan `.chip` sebagai dasar: radius `--chip-radius`, padding ketat,
      teks 0.6875rem weight 700.
- [ ] Nada latar tinted dari warna nada memakai `color-mix` (ikuti pola
      `color-mix` yang sudah dipakai di `globals.css`).
- [ ] Pastikan kontras teks memadai di **kedua** tema (ini titik paling rawan
      gagal — nada premium & sukses di tema terang perlu diperiksa cermat).
- [ ] Periksa seluruh pemakaian `MetaBadge`, termasuk
      `features/captcha/components/difficulty-badge.tsx` bila ia memakainya.

---

### Langkah 6 — Segmented polos + chip filter

**Berkas:** `shared/components/segmented-tabs.tsx`

- [ ] Tambah varian `plain`: tanpa wadah berlatar, item tak aktif hanya teks
      redam, item aktif berupa pill `bg-muted` dengan teks `foreground`.
- [ ] Varian yang sudah ada tetap utuh (dipakai di tempat lain).
- [ ] Sediakan komponen/gaya chip dropdown "Semua ⌄" — pill `bg-card`
      berukuran kecil dengan glyph chevron dari `glyph.tsx`.
- [ ] Pertahankan navigasi papan tombol dan `aria-*` yang sudah ada.

---

### Langkah 7 — Rail kartu horizontal

**Berkas baru:** `shared/components/card-rail.tsx`

- [ ] Buat `CardRail` + `CardRailItem` memakai `.rail` / `.rail-item`.
- [ ] Gunakan `.bleed-x` yang sudah ada agar rail menembus padding halaman
      dan kartu terpotong di tepi kanan.
- [ ] Sembunyikan scrollbar, aktifkan scroll-snap, pertahankan gulir dengan
      papan tombol (`overflow-x-auto` sudah memberi ini secara alami —
      pastikan `tabIndex` tidak dirusak).
- [ ] Sediakan status kosong lewat `empty-state.tsx` yang sudah ada.
- [ ] Uji pada 384 px: tidak boleh menyebabkan halaman ikut bergulir horizontal.

---

### Langkah 8 — Avatar bertumpuk & medali

**Berkas baru:** `shared/components/avatar-stack.tsx`, `shared/components/rank-medal.tsx`

- [ ] `AvatarStack`: terima daftar avatar + batas tampil, saling tumpuk dengan
      ring warna `background`, sisanya jadi lingkaran `bg-muted` berisi `N+`.
- [ ] Beri `aria-label` yang bermakna; avatar individual `aria-hidden`.
- [ ] `RankMedal`: pita untuk peringkat 1–3 (emas/perak/bronze diturunkan dari
      token — gunakan `--premium` untuk emas, dan tambahkan token bila perlu
      untuk perak/bronze; keduanya wajib punya pasangan gelap).
- [ ] Peringkat > 3 dirender sebagai angka biasa, bukan medali.
- [ ] Kedua komponen harus aman ketika daftar avatar kosong / gambar gagal muat.

---

### Langkah 9 — Halaman Peringkat

**Berkas:** `features/leaderboard/leaderboard.tsx`

- [ ] Ubah blok "posisi kamu" menjadi **kartu tersorot**: `bg-card`, radius
      besar, avatar + nama + `@handle • Kamu` + nilai di kanan.
- [ ] Pakai varian segmented `plain` untuk rentang waktu, dan chip dropdown
      untuk filter di kiri (mengikuti tata letak fomo: filter kiri, waktu kanan).
- [ ] Terapkan `RankMedal` untuk 3 teratas.
- [ ] Terapkan `AvatarStack` pada baris peringkat bila datanya tersedia; jika
      tidak ada data lencana/avatar pendukung, **jangan** mengarang data —
      lewati saja bagian ini dan catat di BAB 4.
- [ ] Terapkan `CardRail` untuk seksi ringkasan di atas (padanan "Clans"),
      **hanya jika** sudah ada data nyata untuk itu. Kalau belum ada,
      lewati dan catat.
- [ ] Perhatikan komentar tentang keterbatasan lebar 384 px yang sudah ada di
      berkas ini — jangan menambah tekanan lebar.
- [ ] Jangan mengubah `features/leaderboard/domain.ts` atau `availability.ts`
      kecuali benar-benar perlu; ini pekerjaan presentasi.

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

- _(belum ada)_

### Penyimpangan dari rencana

- **Langkah 1 — selektor tema gelap.** Rencana menyebut `.dark`. Proyek ini
  sebenarnya memakai `:root[data-theme='dark']` (dipasang `shell/theme-init.ts`).
  Pasangan token gelap ditulis di selektor itu, bukan `.dark`.
- **Langkah 1 — `--font-display`.** Token sudah ditambahkan sekarang dengan
  nilai `var(--font-sans)` supaya `.num-display` tidak menunjuk variabel kosong.
  Langkah 2 hanya perlu mengarahkannya ke variabel font Plus Jakarta Sans.
- **Langkah 1 — `--thread-line`.** Dijadikan alias `var(--border)` di kedua tema
  (bukan warna baru), karena `--border` sudah punya nilai terang & gelap yang
  tepat untuk garis penghubung setipis ini. Token tetap ada agar Langkah 10
  bisa menyetelnya sendiri bila ternyata perlu lebih redup.

### Ditemukan tapi di luar cakupan

- _(belum ada)_

---

## BAB 5 — Untuk agent berikutnya

Jika kamu mengambil alih pekerjaan ini di tengah jalan:

1. Baca **BAB 0** seluruhnya. Zona terlarang di 0.1 bukan saran.
2. Lihat ceklis **BAB 3**, temukan kotak tak tercentang pertama, mulai dari sana.
3. Baca **BAB 4** untuk memahami keputusan agent sebelumnya.
4. Jalankan `git log --oneline` untuk melihat langkah mana yang sudah masuk.
5. Kalau ragu antara "mirip fomo" dan "tidak merusak nav pill / island":
   **pilih tidak merusak.** Selalu.
