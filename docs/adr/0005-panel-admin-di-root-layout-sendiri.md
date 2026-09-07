# ADR 0005: Panel admin dipisah ke root layout dan CSP sendiri

- Status: diterima
- Cakupan: `app/(miniapp)/layout.tsx`, `app/(admin)/layout.tsx`, `proxy.ts`, `proxy.test.ts`

## Konteks

`app/layout.tsx` adalah satu-satunya layout yang memuat `<html>` dan `<body>`, jadi Next.js merendernya untuk **setiap** halaman — termasuk `/admin/withdrawals`, `/admin/users`, dan `/admin/economy`. Di dalamnya ada `<Script src="https://libtl.com/sdk.js">`, dan CSP dari `proxy.ts` mengizinkan keluarga `libtl.com` mengeksekusi script di bawah `'strict-dynamic'` — yang berarti SDK itu boleh memuat script lanjutan tanpa batasan host sama sekali.

Panel admin dilayani dari origin yang sama dengan Mini App dan memakai cookie sesi yang sama (`td_session`); `requireAdmin` hanya memeriksa flag `isAdmin` di atas sesi itu. Akibatnya satu skrip pihak ketiga yang bermusuhan di dalam browser admin dapat memanggil `/api/admin/*` dengan `fetch` biasa: permintaannya same-origin dan membawa cookie, jadi `assertSameOrigin` meloloskannya dan `requireAdmin` menerimanya. Blast radius-nya adalah koreksi saldo sampai `maxPayoutCredits()`, penandaan penarikan sebagai lunas, dan pemberian hak admin yang bertahan setelah skrip penyerangnya hilang. Tidak ada satu pun penjagaan yang ada menghalanginya, karena seluruh penjagaannya memang dirancang untuk permintaan lintas-situs.

Saklar mati iklan (`adsMaxViewsPerDay = 0`) menutup fiturnya, bukan pemuatan skripnya.

## Keputusan

1. `app/layout.tsx` dipecah menjadi dua root layout lewat route group: `app/(miniapp)/layout.tsx` membawa SDK Telegram, SDK Monetag, dan hint iklan; `app/(admin)/layout.tsx` tidak membawa satu pun script berorigin luar. Font tetap `next/font` karena berkasnya di-host sendiri, bukan ditarik dari Google saat runtime.
2. `proxy.ts` mencabangkan CSP berdasarkan pathname. Permukaan admin — halaman `/admin/*` maupun API `/api/admin/*` — memakai `script-src 'self' 'nonce-…' 'strict-dynamic'` tanpa host iklan, `img-src`/`media-src`/`frame-src`/`connect-src` tanpa `https:` terbuka, dan `frame-ancestors 'none'`.
3. `frame-ancestors 'none'` hanya dilonggarkan ke daftar host preview di luar produksi, mengikuti pola `DEV_FRAME_ANCESTORS` yang sudah ada.
4. `proxy.test.ts` menahan ketiganya: tidak ada host iklan di `script-src` admin, `frame-ancestors 'none'`, dan root layout admin tidak merender satu pun `src="https://…"`.

## Konsekuensi

Kelas masalahnya menyempit, tetapi **tidak hilang**: panel admin dan Mini App masih berbagi origin, namespace cookie, dan namespace API. Yang berubah adalah tidak ada lagi kode pihak ketiga yang dieksekusi di dokumen yang membawa cookie sesi admin. Perbaikan yang benar-benar menghapus kelasnya adalah memindahkan panel ke origin sendiri (subdomain terpisah) dan memisahkan cookie sesinya; keduanya sengaja belum diambil karena menyentuh alur login dan akan mencabut seluruh sesi admin yang sedang aktif.

Berpindah antara `/` dan `/admin/*` sekarang adalah navigasi antar root layout, jadi Next.js melakukan muat ulang penuh alih-alih transisi klien. Itu tidak menjadi masalah: keduanya memang dua aplikasi berbeda untuk dua orang berbeda.

Menambahkan `<Script>` berorigin luar ke `app/(admin)/layout.tsx` akan menggagalkan `proxy.test.ts`, bukan lolos diam-diam.
