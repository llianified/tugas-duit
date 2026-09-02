# ADR 0001: CSP untuk jaringan iklan

- Status: diterima
- Cakupan: `proxy.ts`, `/api/csp-report`, Monetag

## Konteks

Aplikasi berjalan sebagai Telegram Mini App dan juga di dalam iframe preview. Dokumen utama harus tetap terlindungi oleh Content Security Policy (CSP), sementara rewarded interstitial Monetag membuka iframe serta mengambil gambar, video, dan beacon dari host kreatif pihak ketiga yang dapat berubah.

Panen pelanggaran selama integrasi Adsgram sebelumnya menunjukkan tidak ada kebutuhan menambah host pada `img-src`, `frame-src`, `media-src`, atau `connect-src`. SDK saat itu mengambil kreatif dari satu endpoint lalu merender `blob:`/`data:`. Pelanggaran yang nyata justru berasal dari style inline milik SDK dan atribut style aplikasi.

Monetag berbeda: SDK berasal dari keluarga domain `libtl.com`, tetapi iframe kreatif dan medianya dapat berasal dari domain HTTPS lain. Membatasi render hanya ke `libtl.com` menyebabkan `show_<zone>()` gagal dan tampil sebagai iklan yang tidak selesai ditonton.

## Keputusan

1. `script-src` produksi tetap sempit: script aplikasi, Telegram, dan keluarga `libtl.com`, dengan nonce dan `'strict-dynamic'`.
2. `frame-src`, `img-src`, `media-src`, dan `connect-src` menerima `https:` untuk kebutuhan render kreatif Monetag.
3. `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, dan `frame-ancestors` tetap ketat. Pelonggaran render tidak memberi izin eksekusi script pada dokumen utama.
4. `style-src` dan `style-src-attr` mempertahankan `'unsafe-inline'`. Nonce pada `style-src` akan membuat browser mengabaikan `'unsafe-inline'`, sedangkan SDK menyuntikkan `<style>` tanpa nonce dan aplikasi memakai atribut style untuk offset animasi.
5. Preview dan development menambahkan origin v0/localhost sebagai `frame-ancestors`, serta `ws:`/`wss:` untuk HMR. Produksi hanya boleh dibingkai oleh origin Telegram yang tercantum di `proxy.ts`.
6. CSP dikirim pada request dan response. Header request diperlukan agar nonce yang dibaca layout sama dengan nonce dalam CSP; header response yang sama menjadi kebijakan browser.

## Operasional

Jangan menebak domain kreatif baru. Jika iklan kosong, hitam, diam, atau Promise dari SDK ditolak:

1. deploy sementara dengan `CSP_REPORT_ONLY=1`;
2. gunakan alur iklan nyata selama cukup lama untuk menangkap variasi kreatif;
3. periksa laporan di `/api/csp-report`;
4. tambahkan izin paling sempit yang dibuktikan laporan;
5. kembalikan CSP ke mode enforcing.

## Konsekuensi

Dokumen utama tetap memiliki pengamanan script yang kuat, tetapi resource render HTTPS pihak ketiga dapat dimuat oleh jaringan iklan. Kebijakan ini sengaja memilih kompatibilitas kreatif Monetag tanpa memperluas `script-src`. Perubahan provider iklan wajib mengulang audit report-only karena hasil Adsgram tidak membuktikan kebutuhan provider berikutnya.
