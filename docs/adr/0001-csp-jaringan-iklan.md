# ADR 0001: CSP untuk jaringan iklan

- Status: diterima
- Cakupan: `proxy.ts`, `/api/csp-report`, Monetag, Giga.pub

## Konteks

Aplikasi berjalan sebagai Telegram Mini App dan juga di dalam iframe preview. Dokumen utama harus tetap terlindungi oleh Content Security Policy (CSP). Monetag dipertahankan khusus interstitial otomatis in-app, sedangkan rewarded ad yang menghasilkan tiket task memakai Giga.pub project `7799`. Kedua SDK dapat membuka iframe serta mengambil gambar, video, dan beacon dari host kreatif pihak ketiga yang dapat berubah.

Panen pelanggaran selama integrasi Adsgram sebelumnya menunjukkan tidak ada kebutuhan menambah host pada `img-src`, `frame-src`, `media-src`, atau `connect-src`. SDK saat itu mengambil kreatif dari satu endpoint lalu merender `blob:`/`data:`. Pelanggaran yang nyata justru berasal dari style inline milik SDK dan atribut style aplikasi.

Monetag berbeda: SDK berasal dari keluarga domain `libtl.com`, tetapi iframe kreatif dan medianya dapat berasal dari domain HTTPS lain. Membatasi render hanya ke `libtl.com` menyebabkan `show_<zone>()` gagal dan tampil sebagai iklan yang tidak selesai ditonton.

Giga.pub bukan jaringan tunggal melainkan layer mediasi. Loader `ad.gigapub.tech/script?id=7799` memuat SDK jaringan lain sesuai urutan demand miliknya, dan salah satu anggota chain itu adalah **Monetag milik Giga.pub sendiri**: `https://munqu.com/sdk.js` dengan zone `11612237` dan fungsi global `show_11612237`. Bidder internalnya dimuat dari `https://bid-net.gigapub.tech/loader.js`.

Konsekuensinya, memanggil rewarded ad lewat `showGiga()` tetap memunculkan request bernama Monetag di DevTools. Itu bukan tanda salah pasang atau provider tertukar. Pembeda yang dipakai saat audit:

| Request | Arti |
| --- | --- |
| `libtl.com` + `show_11615417` | interstitial in-app milik aplikasi (Monetag langsung) |
| `munqu.com` + `show_11612237` | mediasi internal Giga.pub, pendapatan tetap lewat Giga.pub |

Zone in-app aplikasi (`11615417`) berbeda dari zone mediasi Giga.pub (`11612237`), sehingga atribusi kedua jalur tidak bercampur.

## Keputusan

1. `script-src` produksi tetap sempit: script aplikasi, Telegram, keluarga `libtl.com`, keluarga `gigapub.tech`, dan `munqu.com`, dengan nonce dan `'strict-dynamic'`.
2. Karena chain mediasi Giga.pub, allowlist `script-src` juga memuat `https://*.gigapub.tech` dan `https://munqu.com`. Di produksi `'strict-dynamic'` membuat allowlist host diabaikan, tetapi di development allowlist itulah yang berlaku — tanpa kedua host tersebut Giga.pub tidak mendapat demand sama sekali dan rewarded selalu jatuh ke pesan gagal muat. Host ini dibuktikan dari isi loader project `7799`, bukan hasil tebakan.
3. `frame-src`, `img-src`, `media-src`, dan `connect-src` menerima `https:` untuk kebutuhan render kreatif Monetag.
4. `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, dan `frame-ancestors` tetap ketat. Pelonggaran render tidak memberi izin eksekusi script pada dokumen utama.
5. `style-src` dan `style-src-attr` mempertahankan `'unsafe-inline'`. Nonce pada `style-src` akan membuat browser mengabaikan `'unsafe-inline'`, sedangkan SDK menyuntikkan `<style>` tanpa nonce dan aplikasi memakai atribut style untuk offset animasi.
6. Preview dan development menambahkan origin v0/localhost sebagai `frame-ancestors`, serta `ws:`/`wss:` untuk HMR. Produksi hanya boleh dibingkai oleh origin Telegram yang tercantum di `proxy.ts`.
7. CSP dikirim pada request dan response. Header request diperlukan agar nonce yang dibaca layout sama dengan nonce dalam CSP; header response yang sama menjadi kebijakan browser.

## Operasional

Sebelum menuduh CSP, pastikan dulu masalahnya bukan mediasi: request ke `munqu.com`/`show_11612237` saat menonton rewarded adalah perilaku normal Giga.pub, bukan kebocoran ke akun Monetag aplikasi.

Jangan menebak domain kreatif baru. Jika iklan kosong, hitam, diam, atau Promise dari SDK ditolak:

1. deploy sementara dengan `CSP_REPORT_ONLY=1`;
2. gunakan alur iklan nyata selama cukup lama untuk menangkap variasi kreatif;
3. periksa laporan di `/api/csp-report`;
4. tambahkan izin paling sempit yang dibuktikan laporan;
5. kembalikan CSP ke mode enforcing.

## Konsekuensi

Dokumen utama tetap memiliki pengamanan script yang kuat, tetapi resource render HTTPS pihak ketiga dapat dimuat oleh jaringan iklan. Origin loader yang diizinkan tetap terbatas: keluarga `libtl.com` untuk in-app, serta keluarga `gigapub.tech` dan `munqu.com` untuk rewarded/tiket. Perubahan provider iklan wajib mengulang audit report-only karena hasil satu jaringan tidak membuktikan kebutuhan jaringan lain.

Risiko yang diterima: chain mediasi Giga.pub dapat berubah tanpa pemberitahuan, sehingga anggota baru berpotensi terblokir di development meski produksi tetap jalan karena `'strict-dynamic'`. Bila rewarded gagal hanya di dev, periksa `/api/csp-report` untuk host script baru dan tambahkan sesempit mungkin, bukan melonggarkan `script-src` secara umum.
