# ADR 0004: Tiket iklan diverifikasi lewat postback Monetag

- Status: diterima
- Menggantikan baris "Klaim iklan dipercaya apa adanya dari klien" pada `docs/keputusan-desain.md`
- Cakupan: `server/ads/postback.ts`, `server/ads/ads.ts`, `app/api/ads/postback`, `app/api/ads/claim`, `shell/use-ad-pass.ts`, `domain/ads/postback.ts`, migrasi `0041`

## Konteks

Sampai sekarang bukti "iklan sudah ditonton" hanya satu: Promise `show_<zone>()` yang resolve di perangkat user, dilaporkan ke `POST /api/ads/claim`. Bukti itu tidak pernah menyentuh server Monetag, jadi ia bisa dipalsukan dari dua arah yang berbeda ongkosnya:

1. **Tap iklan lalu back.** User menekan kreatifnya, halaman pengiklan terbuka, ia langsung kembali. SDK tetap menganggap tayangannya tuntas dan tiketnya terbit.
2. **Memanggil `/api/ads/claim` langsung.** `ticketId` yang sah didapat dari `/api/ads/ticket`, dan tidak ada satu pun bagian dari klaim yang membuktikan ada iklan yang tayang. Ini yang lebih murah dan yang lebih merugikan.

Alasan menunda verifikasi yang dicatat ADR sebelumnya — Reward URL Adsgram terkunci di atas ±50.000 DAU — sudah tidak berlaku sejak rewarded pindah ke Monetag (ADR 0003). Monetag membuka postback untuk semua akun, dan `rewardedShowParams()` sudah mengirim `ymid: ticketId`, jadi setengah pekerjaannya memang sudah terpasang sejak awal.

## Keputusan

1. **Sah = dibayar.** Satu-satunya syarat sebuah postback menerbitkan tiket adalah `reward_event_type` yang menyatakan event itu berbayar. Bukan durasi, bukan jenis event: `impression` maupun `click` sama-sama sah asal berbayar, karena keduanya berarti uang benar-benar masuk. Tayangan yang disaring Monetag sebagai fraud datang sebagai tidak berbayar dan berhenti di situ. Efeknya, hadiah berjalan seiring pendapatan alih-alih seiring laporan perangkat.
2. **Dua ejaan diterima.** Dashboard Monetag mendokumentasikan makro Reward event type sebagai `"yes"`/`"no"`, sedangkan dokumentasi SDK-nya menyebut `valued`/`not_valued`. Keduanya diterima karena yang menentukan bukan ejaannya. Apa pun di luar daftar itu dianggap **tidak** berbayar: gerbang yang tidak yakin harus gagal ke arah menutup.
3. **Postback yang menerbitkan pass, bukan klien.** Saat gerbangnya menyala, `settleAdPostback` yang mempromosikan `pending → ready`; `claimAdTicket` berubah jadi pertanyaan (`awaiting_verification`) dan tidak lagi menulis apa pun. Konsekuensi yang diinginkan: user yang menutup app sebelum konfirmasi datang tetap menemukan passnya sudah siap saat kembali — tidak ada hadiah sah yang hilang karena ia keburu pergi.
4. **Gerbangnya saklar panel (`adsPostbackRequired`), bawaannya mati.** Menyalakannya lewat migrasi berarti seluruh tiket berhenti terbit kalau URL postback belum diisi di dashboard atau secret-nya salah, dan yang terlihat user cuma tombol iklan yang tidak pernah berhasil. Urutan yang benar: deploy, tunggu `ad_views.verified_at` mulai terisi, baru nyalakan dari panel. Postback tetap diterima dan dicatat selama gerbangnya mati, jadi masa tunggu itu memang bisa dipakai membuktikan — bukan sekadar menunggu.
5. **Rahasianya di query string.** Postback berupa GET tanpa header, jadi tidak ada tempat lain. `MONETAG_POSTBACK_SECRET` ikut tercatat di log akses dan diperlakukan begitu: ia tidak membuka data apa pun, hanya bisa mengonfirmasi tiket yang ID-nya sudah harus diketahui lebih dulu, dan menggantinya cukup mengubah env lalu menempel ulang URL-nya. Tanpa env-nya, route menolak semua orang (503) — verifikasi mati, bukan terbuka.
6. **Makro yang gagal terisi dibaca sebagai kosong.** `{ymid}` yang terkirim apa adanya bukan data. Salah pasang URL karena itu membuat tiket **tidak** terbit, bukan terbit gratis.

## Konsekuensi

Jatah tayangan harian berubah arti tanpa berubah rumus: `ready_at is not null` sekarang menghitung impresi yang benar-benar dibayar, bukan klaim yang dilaporkan klien. Angkanya bisa turun setelah gerbangnya menyala. Itu koreksi, bukan regresi — tapi user merasakannya sebagai jatah yang lebih sulit dihabiskan, dan itu harus dijawab apa adanya kalau ditanya.

Ada jeda antara iklan menutup dan tiket masuk, selebar satu perjalanan permintaan antar-server. Klien menunggunya dengan polling `/api/ads/claim` selama 20 detik (`VERIFY_POLL_MS`), yang karenanya menaikkan plafon rate limit route itu dari 20 menjadi 60 per menit. Jendela 20 detik itu bukan tenggat: konfirmasi yang datang setelahnya tetap menerbitkan pass.

Risiko yang diterima: seluruh jalur tiket sekarang bergantung pada satu pihak ketiga yang bisa berhenti mengirim tanpa memberi tahu. Gejalanya adalah `verified_at` yang berhenti terisi sementara `ad_views` baru terus bertambah, dan penawarnya satu saklar panel — bukan deploy. `ad_views_verified_idx` ada khusus untuk pertanyaan sebelahnya: tayangan yang dikonfirmasi setelah tiketnya hangus, yang berarti `adsTicketTtlSeconds` lebih pendek daripada waktu tempuh postback Monetag.

Sinyal `ad_claim_too_fast` dan `ad_claim_burst` berhenti terbit selama gerbangnya menyala. Keduanya mengukur kecurigaan pada klaim yang dipercaya, dan di mode ini klaim tidak memberi apa pun. Yang tersisa `ad_claim_without_ticket`, karena menanyakan tiket yang tidak pernah ada tetap berarti ada yang mengarang `ticketId`.

## Operasional

URL yang ditempel di dashboard Monetag (menu Postback, kolom "Your backend URL") ada di `.env.example`, lengkap dengan makronya. Setelah ditempel: buka app, tonton satu iklan, lalu periksa

```sql
select id, state, verified_at, verify_event, verify_price from ad_views order by created_at desc limit 5;
```

`verified_at` yang terisi berarti jalurnya hidup dan saklar `adsPostbackRequired` boleh dinyalakan dari panel admin. Yang kosong terus berarti URL, secret, atau makronya belum benar — dan selama itu jangan dinyalakan.
