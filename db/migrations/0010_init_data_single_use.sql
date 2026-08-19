-- `initData` Telegram sekali pakai.
--
-- Verifikasi HMAC di `server/telegram.ts` membuktikan payload-nya asli, dan
-- `auth_date` membuktikan ia belum terlalu tua — tapi tidak satu pun dari keduanya
-- membuktikan payload itu belum pernah dipakai. Selama jendela 15 menit masih
-- hidup, string `initData` yang sama bisa dikirim ulang berkali-kali dan setiap
-- kali menukar dirinya dengan satu sesi 30 hari yang penuh: saldo, riwayat, dan
-- pengajuan penarikan ke rekening siapa pun. Satu tangkapan `initData` — dari
-- script pihak ketiga di WebView, log, atau perangkat yang dipinjam — karena itu
-- setara dengan satu akun.
--
-- Tabel ini yang menutupnya. Barisnya adalah tanda "payload ini sudah ditukar",
-- dan primary key-nya yang membuat penukaran kedua ditolak database, bukan
-- ditolak sebuah `if` yang bisa dilewati dua request paralel.
create table used_init_data (
  -- sha256 dari field `hash` milik `initData`, bukan `hash`-nya sendiri —
  -- pola yang sama dengan `sessions.token_hash`: yang disimpan aplikasi ini
  -- untuk mengenali sebuah kredensial tidak pernah kredensialnya sendiri.
  --
  -- Primary key, bukan unique index di atas kolom biasa: tabel ini tidak punya
  -- identitas lain, dan setiap pembacaannya adalah pencarian tepat atas kolom ini.
  hash bytea primary key,
  -- `auth_date + 15 menit`, yaitu titik ketika `verifyInitData` mulai menolak
  -- payload ini sendiri karena kedaluwarsa. Lewat titik itu barisnya tidak lagi
  -- menjaga apa pun — pemeriksaan kesegaran yang mengambil alih — jadi inilah
  -- yang membuat tabel ini bisa disapu habis alih-alih tumbuh selamanya.
  expires_at timestamptz not null
);
-- Untuk sapuan di `scripts/maintenance.ts`, satu-satunya pembaca kolom ini.
create index used_init_data_expires_idx on used_init_data(expires_at);
