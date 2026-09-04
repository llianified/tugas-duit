# Catatan keamanan

Repo ini privat dan dikerjakan pemiliknya sendiri, jadi berkas ini bukan
kebijakan pelaporan untuk orang luar — ini daftar permukaan serang yang harus
diingat setiap kali menyentuh jalur uang. `tugas-duit` memegang saldo user dan
mengeluarkan uang nyata lewat penarikan QRIS; bug di sini berarti kerugian
finansial langsung.

## Permukaan serang, diurutkan dari yang paling berdampak

- **Pencetakan credit** — jalur apa pun yang menambah `credits_earned`,
  komisi, atau isi kolam reward tanpa task yang sah.
- **Penarikan** — melewati plafon, mengubah `amount_idr` setelah kurs
  dibekukan, menarik dua kali dari saldo yang sama, atau mengubah tujuan
  transfer milik orang lain.
- **Bypass autentikasi** — memalsukan `initData` Telegram, mencuri atau
  memakai ulang sesi, atau masuk ke `app/admin/*` tanpa hak admin.
- **Panel admin** — mengubah `economy_config` tanpa hak. Semua besaran ekonomi
  datang dari sini, jadi ini setara mencetak uang.
- **Kebocoran data user** — `telegram_id`, tujuan penarikan, atau riwayat
  transaksi milik user lain.
- **Webhook** — memalsukan callback KlikQRIS agar langganan premium lunas
  tanpa pembayaran, atau memicu `/api/cron/*` tanpa `CRON_SECRET`.

Perubahan di area ini wajib mempertahankan invariant di test dan migrasi
terkait. Angka ekonomi yang terasa "terlalu murah hati" bukan kerentanan — itu
setelan produk di panel admin.

## Aturan pengujian

Uji dengan akun Telegram sendiri, bukan data user nyata. Jangan mengajukan
penarikan yang benar-benar memindahkan uang hanya untuk membuktikan sesuatu,
dan jangan menjalankan uji beban terhadap produksi.

## Rahasia

`TELEGRAM_BOT_TOKEN`, `KLIKQRIS_API_KEY`, `CRON_SECRET`, `DATABASE_URL`, dan
`ADMIN_PASSWORD` tidak boleh masuk ke repo — daftar lengkapnya di
`.env.example`, dan seluruh `.env*` selain itu sudah di-gitignore. Kalau salah
satu pernah ter-commit atau tertempel di luar, rotasi nilainya; menghapus
commit saja tidak cukup.
