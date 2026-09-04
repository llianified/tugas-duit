-- Jadwal interstitial Monetag pindah dari konstanta kode ke panel admin. | Angkanya selama ini hidup sebagai `DEFAULT_IN_APP_ADS_SETTINGS` di | `domain/in-app-ads.ts`: 2 iklan per 6 menit, jeda 30 detik, iklan pertama setelah | 5 detik. Itu satu-satunya tuas PEMASUKAN yang tidak bisa disetel tanpa deploy, | sementara seluruh sisi BIAYA (kolam reward, energi, tiket berhadiah) sudah bisa. | Akibatnya frekuensi impresi tidak pernah bisa diuji terhadap CPM yang berubah-ubah. | `cappingHours` di kode adalah pecahan jam (0.1 = 6 menit); di config ia disimpan | sebagai MENIT karena validator config menolak nilai bukan bilangan bulat. Konversi | /60-nya ada di `inAppAdsSettings()`. | `everyPage` tidak ikut pindah: config ekonomi hanya menerima angka, dan mereset sesi | tiap pindah view akan membuat plafon frekuensi tidak pernah berlaku di app ini. | Nilai di sini SAMA dengan konstanta lama, jadi migrasi ini tidak mengubah perilaku | produksi. Yang berubah cuma tempat menyetelnya. | Urutan `||` seperti migrasi sebelumnya: objek default di kiri, `config` di kanan, | supaya baris yang sudah disetel admin tidak tertimpa.
update economy_config
set config = jsonb_build_object(
  'inAppAdsFrequency', 2,
  'inAppAdsCappingMinutes', 6,
  'inAppAdsIntervalSeconds', 30,
  'inAppAdsTimeoutSeconds', 5
) || config
where id = 1;
