# ADR 0002: Sesi di dalam iframe lintas situs

- Status: diterima
- Cakupan: `server/auth/session.ts`, `shell/api-client.ts`, `/api/dev/login`

## Konteks

Aplikasi dibuka di dalam iframe milik situs lain: Telegram Web pada penggunaan nyata dan v0 pada preview. Cookie sesi karena itu diperlakukan sebagai cookie pihak ketiga. `SameSite=None` saja tidak cukup pada browser yang membuang atau membatasi cookie pihak ketiga; gejalanya adalah login preview berhasil tetapi request sesi berikutnya kembali tanpa user.

Token sesi mentah tidak boleh disimpan di database. JavaScript produksi juga tidak boleh memperoleh token tersebut. Di sisi lain, preview perlu jalur cadangan yang tidak bergantung pada cookie jar agar tetap bisa diuji pada Safari, Firefox, dan konfigurasi yang memblokir cookie pihak ketiga.

## Keputusan

1. Cookie `td_session` menggunakan `HttpOnly`, `Secure`, `SameSite=None`, dan `Partitioned` (CHIPS), dengan umur 30 hari.
2. Database hanya menyimpan hash SHA-256 token. Token mentah hanya berada pada cookie atau memori proses klien preview.
3. Maksimal lima sesi aktif dipertahankan per user; sesi yang lebih lama dicabut.
4. Header `x-td-session` adalah pembawa cadangan khusus preview. Server hanya membacanya saat `isPreviewShell()` bernilai benar: bukan production, tanpa `DATABASE_URL`, dan bukan proses Vitest.
5. `/api/dev/login` hanya hidup pada database preview. `previewSessionToken()` kembali `null` di luar preview, sehingga token tidak pernah diserahkan kepada JavaScript produksi.
6. Klien menyimpan token preview di memori modul, bukan `localStorage`. Token hilang saat tab ditutup dan tidak dipersistenkan ke storage yang dapat dibaca script pada kunjungan berikutnya.
7. Penghapusan cookie harus mengulang atribut `Secure`, `SameSite=None`, dan `Partitioned`. Cookie berpartisi memiliki kunci berbeda dari cookie biasa dengan nama sama; delete tanpa atribut yang sesuai dapat meninggalkan sesi asli tetap hidup.

## Konsekuensi

Chrome modern dapat memakai cookie CHIPS secara langsung. Browser yang tetap menolak cookie pihak ketiga masih dapat menjalankan preview lewat header cadangan, tanpa melonggarkan produksi. Preview v0 dan Telegram Web memiliki partisi sesi berbeda dan dapat meminta login ulang secara independen; ini disengaja.

Suite tes tidak memakai jalur header preview, sehingga tes sesi tetap membuktikan perilaku cookie utama. Setiap perubahan atribut cookie harus memperbarui jalur create dan destroy sekaligus serta mempertahankan pengujian keduanya di `server/auth/session.test.ts`.
