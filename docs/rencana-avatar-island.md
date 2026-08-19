# Rencana pill profil (avatar Telegram) di brand band

Status: **usulan, belum disetujui, belum ada kode.** Dokumen ini yang dikonfirmasi dulu
(aturan keras #1), baru implementasi jalan.

Tujuan: menaruh foto profil Telegram user sebagai pill paling kiri di brand band beranda.
Saat ditekan, pill itu mengembang menjadi panel ringkasan statistik user — pola island yang
sama dengan pill rank dan pill kesulitan, bukan mekanisme baru.

Keputusan yang sudah diambil pemilik repo:

1. Isi panel = **ringkasan padat + tombol "Lihat statistik"**, bukan duplikat view Statistik.
2. Pill avatar **disembunyikan saat di menu task** (view `captcha`).
3. Foto tidak ada / gagal dimuat → **ikon user generik**.

Tidak ada perubahan ekonomi, kontrak DB, atau alur monetisasi di rencana ini. Yang berubah
hanya lapisan UI dan satu perluasan tipe respons `/api/session` di klien (§4).

---

## 1. Fakta kode sekarang yang membatasi desain

Tiga hal ini menentukan bentuk implementasinya, dan semuanya sudah ada — tidak perlu
dibangun ulang:

**a. Brand band adalah satu baris flex yang di-center, tanpa `gap`.**
`.brand-band` (`app/globals.css:317`) full-width `justify-content: center`; di dalamnya
`.brand-band-row` (`:510`) juga `justify-content: center`. Antar pill **tidak ada `gap`** —
hasil ukur di menu task: pill rank `x=93 w=104`, pill kesulitan `x=197 w=94`, jadi keduanya
benar-benar bersentuhan dan jarak visualnya datang dari padding dalam pill
(`className="pl-1.5"` di `DifficultyIsland`). Toggle tema (`.brand-band-control`, `:519`)
**absolute** ke `right: var(--content-px)`, jadi ia tidak ikut menggeser titik tengah baris.
Konsekuensi untuk rencana ini: menambah pill avatar sebagai anak pertama `.brand-band-row`
otomatis membuat klaster (avatar · tier) tetap center — tidak ada CSS baru untuk itu.

**b. Panel island selalu terbuka di lebar penuh dan center; yang berbeda cuma jangkar
tutupnya.** `.island` (`:348`) menghitung `--island-open-*` dari viewport, sedangkan
`--island-closed-top/left/w` datang dari pengukuran pill sendiri (`--island-pill-*` yang
ditulis `useIslandGeometry`). Artinya panel avatar akan melebar dari pojok kiri ke lebar
penuh tanpa kode animasi baru; cukup pakai `IslandPill`.

**c. Aksi "minggir" sudah generik untuk posisi pill mana pun.**
`.island[data-island-aside='left']` menggeser `-(pillLeft + pillW + 0.5rem)` dan `'right'`
menggeser `100vw - pillLeft + 0.5rem` (`:423`–`:428`), keduanya dihitung dari kotak pill yang
diukur, bukan dari asumsi "pill kedua". Jadi pill ketiga tidak butuh varian arah baru — hanya
butuh keputusan arah per kombinasi (§3). `useIslandGeometry` juga sudah mengamati
`parentElement` dan `transitionend` baris, jadi pill yang bergeser karena tetangganya
muncul/hilang tetap terukur ulang.

Sisi data:

- `/api/session` sudah mengirim `user.firstName`, `user.username`, `user.photoUrl`,
  `user.id` (public id), `user.balance` (`app/api/session/route.ts:45`), dari kolom
  `users.photo_url` yang di-upsert setiap login Telegram
  (`app/api/auth/telegram/route.ts:16`).
- **Tipe `SessionResponse` di `shell/session-api.ts:16` belum punya `username` dan `banned`,**
  padahal route mengirimkannya. Ini yang perlu ditambah, bukan endpoint baru.
- Angka statistik sudah tersedia di klien lewat `session.stats` (`UserStats`,
  `features/stats/domain.ts`) yang sudah di-fetch untuk beranda, dan `session.openStats`
  (`shell/use-reward-session.ts`) sudah membuka view Statistik lewat `pushView('stats')`.
- CSP `img-src` sudah memuat `https://t.me` dan `https://*.telegram.org`
  (`proxy.ts:14`) — domain userpic Telegram, jadi **tidak ada pelonggaran CSP** di rencana ini.
- `next.config.mjs` memakai `images.unoptimized: true` dan repo tidak memakai `next/image`
  sama sekali; pill avatar pakai `<img>` biasa supaya konsisten.

---

## 2. Bentuk pill dan panel

**Pill** (anak pertama `.brand-band-row`, kiri pill tier):

- Kotak bulat `size-[var(--brand-pill-h)]`, radius `calc(var(--brand-pill-h)/2)`, border dan
  `bg-muted` sama seperti pill lain, foto `object-cover` memenuhi kotak.
- Karena baris tidak punya `gap`, jarak ke pill tier diberikan pill avatar sendiri
  (`className="mr-1.5"` pada wrapper `.island`) — pola yang sama dengan `pl-1.5` milik
  `DifficultyIsland`, bukan menambahkan `gap` ke baris (yang akan menggeser klaster tier/sulit
  yang sudah disetujui bentuknya).
- Label aksesibilitas: `openLabel="Buka ringkasan profil"`, `closeLabel="Tutup ringkasan
  profil"`, `pillTitle` = nama depan. `srSummary` menyebut nama + jumlah task selesai, supaya
  pembaca layar tidak cuma mendengar "gambar".

**Panel** — 4 region `island-region` dipisah `IslandDivider`, mengikuti ritme `RankIsland`:

| Region | Kiri (11px, muted) | Kanan (12px, semibold) |
| --- | --- | --- |
| Identitas | avatar 32px + nama depan | `@username`, atau public id kalau username kosong |
| Task | `Task selesai` | `{completedCount}` + `· {activeDays} hari aktif` |
| Kualitas | `Rata-rata bintang` | `{averageStars}` + `· {perfectShare}% sempurna` |
| Saldo | `Saldo` | `{formatCredits(balance)} credit` + `formatRupiah(creditsToRupiah(balance))` |

Region terakhir ditutup satu tombol lebar penuh **"Lihat statistik"** yang memanggil
`openStats()` lalu menutup panel. Angka Rupiah wajib lewat `creditsToRupiah` +
`formatRupiah` (aturan keras #3 dan #4) — panel ini tidak menghitung apa pun sendiri, semua
field dibaca dari `UserStats` yang sudah dihitung server.

Kenapa hanya empat baris: view Statistik lengkap sudah ada satu tap jauhnya lewat tombol itu.
Panel island tingginya animasi dari `scrollHeight`; kalau isinya sepanjang view Statistik ia
akan melewati tinggi layar 639px dan butuh scroll di dalam header — bentuk yang belum pernah
ada di app ini.

**Fallback foto.** `photoUrl` bisa `null` (login tanpa foto, atau `/api/dev/login`) dan URL
userpic Telegram bisa berhenti valid tanpa pemberitahuan. Jadi dua jalur, satu tampilan:
`photoUrl === null` **atau** `onError` pada `<img>` → state lokal `photoBroken` → render ikon
`User` dari lucide di atas `bg-muted text-muted-foreground`. Ikon yang sama dipakai di panel.

---

## 3. Perilaku tiga pill: satu panel terbuka, sisanya minggir

`ProgressionBadges` sekarang memegang satu slot `openPanel: 'rank' | 'difficulty' | null`.
Slot itu diperluas menjadi `'profile' | 'rank' | 'difficulty' | null` — tetap satu panel
terbuka pada satu waktu, jadi invarian yang sekarang tidak berubah.

Arah minggir per kombinasi (urutan pill: profil · rank · sulit):

| Panel terbuka | profil | rank | sulit |
| --- | --- | --- | --- |
| `profile` | terbuka | `right` | `right` |
| `rank` | `left` | terbuka | `right` |
| `difficulty` | `left` | `left` | terbuka |

Aturannya satu kalimat: pill di kiri panel yang terbuka keluar ke kiri, pill di kanannya
keluar ke kanan. Tidak ada CSS baru; hanya nilai `slideOutTo` yang diisi berbeda.

**Sembunyi di menu task.** Pill profil tidak dirender saat `effectiveView === 'captcha'`.
Karena `.brand-band-row` center, hilangnya pill itu membuat klaster tier+sulit otomatis
recenter, dan `useIslandGeometry` sudah re-measure lewat observer baris — jadi pill rank yang
sedang terbuka tidak akan menutup ke jangkar lama. Yang tetap perlu dijaga: kalau panel
profil sedang terbuka lalu user menekan "Mulai task", panel harus ikut ditutup, bukan
tertinggal dalam state `open` pada komponen yang di-unmount. Ini `useEffect` di
`ProgressionBadges` yang mereset `openPanel` ketika pill sumbernya berhenti dirender —
sekaligus memastikan `onPanelOpenChange(false)` terkirim supaya `hideThemeToggle` di
`AppFrame` kembali normal.

---

## 4. Berkas yang disentuh

| Path | Perubahan |
| --- | --- |
| `features/home/profile-island.tsx` (baru) | `ProfileIsland`: pill avatar + panel 4 region + tombol ke Statistik. Menerima `user`, `stats`, `onOpenStats` |
| `features/home/profile-avatar.tsx` (baru) | `ProfileAvatar`: `<img>` + fallback ikon `User`, ukuran lewat prop, dipakai di pill dan di panel |
| `features/home/progression-badges.tsx` | slot `openPanel` diperluas ke `'profile'`; tabel arah §3; prop baru `user`, `stats`, `showProfile`, `onOpenStats`; efek reset saat pill sumber hilang |
| `shell/app-shell.tsx` | teruskan `session.user`, `session.stats`, `session.openStats`, dan `showProfile={effectiveView !== 'captcha'}` ke `ProgressionBadges` |
| `shell/session-api.ts` | `SessionResponse['user']` ditambah `username: string \| null` dan `banned?: boolean` supaya cocok dengan yang sudah dikirim route |
| `docs/keputusan-desain.md` | satu baris: kenapa panel profil sengaja tidak memuat seluruh angka Statistik, dan kenapa pill hilang di view task |
| `CLAUDE.md` | tidak berubah (tidak ada direktori baru) |

Tidak ada perubahan di `app/api/*`, `server/*`, `db/migrations/*`, `proxy.ts`, dan
`next.config.mjs`. Kalau ternyata ada, berarti rencana ini keluar jalur dan harus ditanyakan
ulang.

---

## 5. Aksesibilitas dan bahasa

- Foto profil adalah dekorasi dari sudut pandang pembaca layar (namanya sudah diucapkan di
  `aria-label` tombol), jadi `<img alt="">` + `aria-hidden` pada ikon fallback. Tidak ada
  "Foto profil Rizal" yang diulang dua kali.
- Tombol pill tetap satu `button` dengan `aria-expanded`/`aria-controls` dari `IslandPill`,
  `panelId="profile-island"`.
- Tombol "Lihat statistik" berada di dalam `island-panel-content`, dan panel itu sudah
  membungkus klik ke `onClose`; handler tombol memanggil `openStats()` **dan** membiarkan
  penutupan berjalan, jadi tidak ada panel yang menggantung di atas view baru.
- Semua teks Indonesia (aturan keras #7), tanpa komentar di kode (aturan keras #8).

---

## 6. Risiko

| Risiko | Kenapa mungkin | Penanganan |
| --- | --- | --- |
| Lebar klaster di layar sempit | tiga pill (avatar 30px + tier ~104px + sulit ~94px) di lebar 384px menyisakan ruang tipis dari toggle tema | pill profil tidak dirender di view task, jadi tiga pill tidak pernah tampil bersamaan; kombinasi maksimum tetap dua |
| Userpic 404 setelah user ganti foto | URL disimpan saat login, Telegram tidak memberi tahu perubahan | `onError` → ikon generik; `photo_url` ter-refresh sendiri di login berikutnya |
| Panel profil terbuka lalu masuk task | komponen di-unmount sambil `openPanel='profile'` | efek reset di §3, diuji manual |
| Pengukuran jangkar basi saat pill hilang | pill rank bergeser tanpa berubah ukuran | sudah ditangani observer baris di `useIslandGeometry`; tidak perlu kode baru, tapi wajib dicek visual |

---

## 7. Verifikasi sebelum dinyatakan selesai

`pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`, lalu pemeriksaan visual di
384×639 (light dan dark):

1. Beranda: klaster avatar+tier tetap center, toggle tema tidak bergeser.
2. Buka panel profil → pill tier minggir ke kanan, toggle tema tersembunyi, panel melebar
   dari kiri.
3. Buka panel rank → pill profil minggir ke kiri.
4. Mulai task → pill profil hilang, klaster tier+sulit center, panel rank masih bisa dibuka
   dan menutup ke jangkar yang benar.
5. `photoUrl` null (jalur `/api/dev/login`) → ikon generik, bukan kotak kosong.

---

## 8. Yang masih harus diputuskan pemilik repo

1. Empat baris panel di §2 — sudah pas, atau ada angka lain yang lebih layak (misalnya
   streak, yang sekarang sudah ada di panel rank sehingga sengaja tidak diulang)?
2. Baris identitas menampilkan `@username`; kalau username kosong, tampilkan public id atau
   biarkan kosong?
3. Tombol "Lihat statistik" saja, atau perlu tombol keluar/logout di panel ini juga?
   (`DELETE /api/session` sudah ada, tapi belum pernah dipakai dari UI.)
4. Pill profil di view non-beranda selain task (riwayat, referral, tarik) — tetap tampil,
   atau khusus beranda saja?
