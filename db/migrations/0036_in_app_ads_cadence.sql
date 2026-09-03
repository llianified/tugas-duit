-- Perbaiki jendela interstitial yang lebih pendek daripada temponya sendiri. | Validator config lama hanya memeriksa bahwa semua iklan MUAT di jendelanya | (`timeout + (frequency - 1) * interval <= capping`). Pemeriksaan itu selalu lolos | pada `frequency: 1`, sehingga kombinasi 1 iklan / jendela 1 menit / jeda 120 detik | tersimpan tanpa keluhan — lalu tayang tiap 60 detik, karena SDK Monetag menghitung | `interval` cuma di dalam satu jendela dan menjalankan `timeout` dari nol tiap | jendela baru. Yang dirasakan user: interstitial nembak berulang, dan nilai jeda | 120 detik di panel tidak pernah dipakai sama sekali.
-- Syarat keduanya sekarang `capping >= frequency * interval`, sama dengan | `minInAppWindowSeconds()` di `domain/ads/in-app-ads.ts`. Baris yang sudah tersimpan | tidak divalidasi ulang saat dibaca `/api/session`, jadi perbaikannya harus terjadi | di sini — kode klien hanya menaikkan jendela saat runtime, bukan menulis balik.
-- Yang dinaikkan jendelanya, bukan jedanya: jeda antar iklan adalah angka yang | paling langsung dimaksud admin, panjang jendela cuma pembungkusnya. Baris yang | sudah memenuhi syarat tidak bergeser karena `greatest()` mempertahankan nilai | yang lebih besar.
update economy_config
set config = config || jsonb_build_object(
  'inAppAdsCappingMinutes',
  greatest(
    coalesce((config->>'inAppAdsCappingMinutes')::numeric, 6),
    ceil(
      greatest(
        coalesce((config->>'inAppAdsTimeoutSeconds')::numeric, 5)
          + (coalesce((config->>'inAppAdsFrequency')::numeric, 2) - 1)
            * coalesce((config->>'inAppAdsIntervalSeconds')::numeric, 30),
        coalesce((config->>'inAppAdsFrequency')::numeric, 2)
          * coalesce((config->>'inAppAdsIntervalSeconds')::numeric, 30)
      ) / 60.0
    )
  )::int
)
where id = 1
  and coalesce((config->>'inAppAdsFrequency')::numeric, 2) > 0;
