# ADR 0001: CSP untuk jaringan iklan

- Status: diterima
- Cakupan: `proxy.ts`, `/api/csp-report`, Monetag, OnClicka

## Konteks

Aplikasi berjalan sebagai Telegram Mini App dan juga di dalam iframe preview. Dokumen utama harus tetap terlindungi oleh Content Security Policy (CSP). Monetag dipertahankan khusus interstitial otomatis in-app, sedangkan rewarded ad yang menghasilkan tiket task memakai OnClicka spot `6145580` (AD Code `461406`). Kedua SDK dapat membuka iframe serta mengambil gambar, video, dan beacon dari host kreatif pihak ketiga yang dapat berubah.

Panen pelanggaran selama integrasi Adsgram sebelumnya menunjukkan tidak ada kebutuhan menambah host pada `img-src`, `frame-src`, `media-src`, atau `connect-src`. SDK saat itu mengambil kreatif dari satu endpoint lalu merender `blob:`/`data:`. Pelanggaran yang nyata justru berasal dari style inline milik SDK dan atribut style aplikasi.

Monetag berbeda: SDK berasal dari keluarga domain `libtl.com`, tetapi iframe kreatif dan medianya dapat berasal dari domain HTTPS lain. Membatasi render hanya ke `libtl.com` menyebabkan `show_<zone>()` gagal dan tampil sebagai iklan yang tidak selesai ditonton.

OnClicka menggantikan Giga.pub sejak revisi ini; pendapatan Giga.pub terlalu kecil untuk dipertahankan. Perbedaan bentuk integrasinya penting untuk audit: Giga.pub memasang satu fungsi global tetap (`showGiga`) begitu loader-nya selesai, sedangkan OnClicka hanya memasang `initCdTma`. Fungsi show-nya baru lahir dari `initCdTma({ id })` untuk satu spot, jadi kegagalan bisa muncul di dua tempat berbeda — loader tidak termuat, atau init ditolak karena spot salah/nonaktif. Adapter di `shell/onclicka-sdk.ts` memisahkan keduanya dan hanya melakukan init sekali per sesi.

Pembeda yang dipakai saat audit:

| Request | Arti |
| --- | --- |
| `libtl.com` + `show_11615417` | interstitial in-app milik aplikasi (Monetag langsung) |
| `js.onclckvd.com` + `initCdTma` | rewarded/tiket lewat OnClicka |

Berbeda dari Giga.pub, chain demand OnClicka belum pernah dipanen lewat report-only. Host `script-src` di bawah karena itu adalah titik awal yang belum dibuktikan, bukan hasil audit.

## Keputusan

1. `script-src` produksi tetap sempit: script aplikasi, Telegram, keluarga `libtl.com`, dan keluarga `onclckvd.com`, dengan nonce dan `'strict-dynamic'`.
2. Allowlist `script-src` memuat `https://js.onclckvd.com` dan `https://*.onclckvd.com`. Di produksi `'strict-dynamic'` membuat allowlist host diabaikan, tetapi di development allowlist itulah yang berlaku. Subdomain wildcard-nya sengaja ada karena modul lanjutan OnClicka belum diketahui pasti; bila laporan report-only menunjukkan host di luar `onclckvd.com`, tambahkan per host dan jangan lebar-lebar.
3. `frame-src`, `img-src`, `media-src`, dan `connect-src` menerima `https:` untuk kebutuhan render kreatif Monetag.
4. `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, dan `frame-ancestors` tetap ketat. Pelonggaran render tidak memberi izin eksekusi script pada dokumen utama.
5. `style-src` dan `style-src-attr` mempertahankan `'unsafe-inline'`. Nonce pada `style-src` akan membuat browser mengabaikan `'unsafe-inline'`, sedangkan SDK menyuntikkan `<style>` tanpa nonce dan aplikasi memakai atribut style untuk offset animasi.
6. Preview dan development menambahkan origin v0/localhost sebagai `frame-ancestors`, serta `ws:`/`wss:` untuk HMR. Produksi hanya boleh dibingkai oleh origin Telegram yang tercantum di `proxy.ts`.
7. CSP dikirim pada request dan response. Header request diperlukan agar nonce yang dibaca layout sama dengan nonce dalam CSP; header response yang sama menjadi kebijakan browser.

## Operasional

Sebelum menuduh CSP, pisahkan dulu dua kegagalan OnClicka yang tampak sama di UI ("Iklan gagal dimuat"): `window.initCdTma` tidak pernah muncul berarti loader-nya yang terhalang, sedangkan `initCdTma` ada tetapi Promise-nya reject berarti spot-nya yang bermasalah — salah ID, belum aktif, atau akun belum lolos verifikasi email.

Jangan menebak domain kreatif baru. Jika iklan kosong, hitam, diam, atau Promise dari SDK ditolak:

1. deploy sementara dengan `CSP_REPORT_ONLY=1`;
2. gunakan alur iklan nyata selama cukup lama untuk menangkap variasi kreatif;
3. periksa laporan di `/api/csp-report`;
4. tambahkan izin paling sempit yang dibuktikan laporan;
5. kembalikan CSP ke mode enforcing.

## Konsekuensi

Dokumen utama tetap memiliki pengamanan script yang kuat, tetapi resource render HTTPS pihak ketiga dapat dimuat oleh jaringan iklan. Origin loader yang diizinkan tetap terbatas: keluarga `libtl.com` untuk in-app, dan keluarga `onclckvd.com` untuk rewarded/tiket. Perubahan provider iklan wajib mengulang audit report-only karena hasil satu jaringan tidak membuktikan kebutuhan jaringan lain — termasuk pergantian ke OnClicka ini, yang audit-nya BELUM dijalankan.

Risiko yang diterima: chain demand OnClicka dapat memuat host di luar `onclckvd.com` tanpa pemberitahuan, sehingga berpotensi terblokir di development meski produksi tetap jalan karena `'strict-dynamic'`. Bila rewarded gagal hanya di dev, periksa `/api/csp-report` untuk host script baru dan tambahkan sesempit mungkin, bukan melonggarkan `script-src` secara umum.
