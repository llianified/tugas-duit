# Kebijakan keamanan

`tugas-duit` memegang saldo user dan mengeluarkan uang nyata lewat penarikan
QRIS. Kerentanan di sini bukan cuma bug — bisa berarti kerugian finansial
langsung. Laporan diperlakukan sebagai prioritas tertinggi.

## Cara melaporkan

**Jangan buka issue publik untuk kerentanan keamanan.** Issue publik memberi
tahu penyerang sebelum tambalannya ada.

Pilih salah satu:

1. **GitHub Security Advisory** (disarankan) — tab **Security** → **Report a
   vulnerability** di repo ini. Jalur ini privat dan langsung ke pemilik repo.
2. **Telegram** — hubungi pemilik repo lewat bot/channel di
   [@tugasduit](https://t.me/tugasduit).

Sertakan sebisanya: langkah reproduksi, dampak yang kamu perkirakan, dan
apakah kamu sudah pernah memicunya di produksi.

## Yang kami tanggapi paling serius

Diurutkan dari yang paling berdampak:

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

## Di luar cakupan

- Temuan scanner otomatis tanpa dampak yang bisa ditunjukkan.
- Rate limit yang terasa longgar tanpa contoh penyalahgunaan nyata.
- Rekayasa sosial terhadap user atau pemilik repo.
- Serangan yang butuh akses fisik atau perangkat user yang sudah disusupi.
- Angka ekonomi yang dianggap "terlalu murah hati". Itu setelan produk di
  panel admin, bukan kerentanan.

## Aturan pengujian

Uji **hanya** dengan akun Telegram-mu sendiri. Jangan menyentuh saldo, data,
atau penarikan user lain, dan jangan mengajukan penarikan yang benar-benar
memindahkan uang untuk membuktikan sesuatu — jelaskan langkahnya, jangan
dieksekusi sampai selesai. Jangan pula menjalankan uji beban terhadap
produksi.

## Rahasia yang bocor

Kalau kamu menemukan credential terekspos — `TELEGRAM_BOT_TOKEN`,
`KLIKQRIS_API_KEY`, `CRON_SECRET`, `DATABASE_URL`, atau `ADMIN_PASSWORD` —
laporkan segera lewat jalur privat di atas dan jangan memakainya untuk
mengonfirmasi apa pun. Daftar lengkap env var yang dipakai ada di
`.env.example`; tidak ada satu pun yang boleh masuk ke repo.
