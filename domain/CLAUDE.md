# domain/

Aturan ekonomi murni — tanpa I/O, tanpa DB, tanpa `fetch`. Semua fungsi di sini deterministik:
input → output, tanpa efek samping. Kalau butuh akses DB, itu tidak tergolong `domain/`, taruh di
`server/`.

- **Jangan hardcode angka ekonomi.** Semua besaran (nilai credit, plafon, reward per kesulitan,
  dst) datang dari `economy-config.ts` lewat `economyConfig()` — bukan konstanta di file ini.
  Menyetel ekonomi = admin ubah config di DB, bukan deploy kode baru.
- `economy.ts` mengekspor aturan (konversi credit↔Rupiah, syarat penarikan), bukan angkanya
  sendiri. Komponen di luar `domain/` memanggil fungsi ini (`creditsToRupiah`, dst) — tidak
  pernah mengalikan `creditValueIdr` sendiri.
- `reward-pool.ts` menahan penghasilan, bukan plafon harian: kolam yang mengisi ulang bertahap,
  tanpa reset tengah malam. Bentuknya sengaja dikembarkan dengan `energy.ts` (stok tersimpan +
  jam acuan regen). Kapasitasnya turunan rank dan streak, jadi selalu dikirim dari pemanggil —
  `domain/` tidak boleh membaca DB untuk mencarinya sendiri.
- Rank dan streak menambah **daya tampung** kolam, bukan kecepatan isi ulangnya. Kalau perlu
  mempercepat penghasilan, itu `rewardPoolRegenMinutes`/`rewardPoolRegenCredits`, bukan bonus.
- Setiap perubahan business rule wajib memperbarui atau menambah test kontrak yang relevan.
  Modul tipe/proyeksi sederhana boleh diuji lewat konsumen utamanya; jangan membuat test kosong
  hanya demi pasangan nama, dan jangan hapus test untuk "menyelesaikan" kegagalan.
