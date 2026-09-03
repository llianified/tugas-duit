# ADR 0003: Rewarded pindah dari OnClicka ke Monetag

- Status: diterima
- Menggantikan bagian OnClicka pada ADR 0001
- Cakupan: `server/ads/ad-provider.ts`, `shell/use-ad-pass.ts`, `shell/ad-watch.ts`, `app/layout.tsx`, `proxy.ts`

## Konteks

Tiket berhadiah memakai OnClicka (spot `6145580`) sementara interstitial otomatis memakai Monetag (zone `11615417`). Dua SDK, dua penjadwal, satu layar — dan keduanya sama-sama merebut layar tanpa saling mengenal. Tabrakannya bukan kemungkinan melainkan kepastian: interstitial otomatis dapat jatuh di tengah tayangan rewarded, dan `watchAdToFinish` hanya bisa menyelamatkan tiketnya lewat `late`, bukan mencegah user membaca "iklannya belum tuntas" untuk iklan yang sebenarnya tuntas.

Audit report-only untuk chain demand OnClicka juga tidak pernah dijalankan — ADR 0001 mencatat sendiri bahwa host `script-src`-nya adalah titik awal yang belum dibuktikan, bukan hasil panen pelanggaran.

## Keputusan

1. Tiket berhadiah memakai Monetag, **zone yang sama** dengan interstitial otomatis. Satu zone melayani dua format lewat satu fungsi global: `show_<zone>()` tanpa argumen adalah Rewarded Interstitial, `show_<zone>({ type: 'inApp', inAppSettings })` adalah interstitial otomatis. Discriminator itulah satu-satunya pembeda, dan itu sudah dicatat di `docs/keputusan-desain.md`.
2. Zone-nya tetap datang dari server lewat `unitId` di `/api/ads/ticket`, bukan dari konstanta klien. Tiga tempat harus menunjuk angka yang sama — script tag di `app/layout.tsx`, fungsi yang dipanggil klien, dan `ad_views.block_id` yang tersimpan — dan menyerahkannya ke satu sumber membuat selisihnya tidak mungkin.
3. Loader `js.onclckvd.com` dicabut dari `app/layout.tsx`, adapter `shell/onclicka-sdk.ts` dan konstanta `domain/ads/onclicka-spot.ts` dihapus.
4. `script-src` menciut kembali ke keluarga `libtl.com` saja. Allowlist yang tidak lagi punya pemakai adalah permukaan serang tanpa imbalan, dan keluarga `libtl.com` sudah dipanen lewat report-only.
5. `AdProvider` menyusut menjadi satu nilai tetapi **tetap dikirim** di payload sesi dan tiket. Barisnya tidak dihapus karena `ad_views.block_id` yang sudah tersimpan berisi campuran unit dari jaringan lama; klien perlu tahu SDK mana yang dimaksud satu tiket, dan penambahan jaringan berikutnya tidak perlu mengubah kontrak API.

## Konsekuensi

Satu SDK yang menengahi dirinya sendiri seharusnya tidak menumpuk rewarded di atas interstitial-nya sendiri — itu keuntungan yang diharapkan, bukan yang dijanjikan; kalau tumpukan masih terjadi, sekarang ia satu jaringan dan bisa dilaporkan sebagai satu bug.

Risiko yang diterima: kedua format berbagi satu zone, jadi plafon frekuensi Monetag menghitung keduanya dalam satu ember, dan gangguan pada zone itu mematikan dua sumber pemasukan sekaligus. Kalau salah satunya perlu dipisah, buat zone kedua di dashboard lalu bedakan lewat `resolveAdProvider()` — bukan lewat konstanta baru di klien.

Baris `ad_views` lama tetap menyimpan `block_id` `6145580`. Itu jejak historis yang benar dan tidak boleh ditulis ulang; laporan yang membandingkan pendapatan per unit harus memperlakukan angka itu sebagai jaringan yang sudah pensiun.

## Operasional

Kegagalan rewarded sekarang punya satu bentuk, bukan dua: `window.show_<zone>` tidak pernah muncul berarti loader `libtl.com` terhalang. Prosedur report-only pada ADR 0001 tetap berlaku apa adanya untuk host kreatif.
