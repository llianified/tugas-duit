-- Turunkan target misi iklan yang melewati plafon tayangan hariannya. | `validateEconomyConfig` sekarang menolak `missionAdsTarget > adsMaxViewsPerDay`, dan | validator itu jalan JUGA saat baris `economy_config` dibaca (`parseRow` di | `server/economy/economy-config.ts`) — bukan cuma saat admin menyimpan. Baris tersimpan yang | melanggar aturan baru karena itu tidak sekadar sulit disunting: ia membuat | `loadEconomyConfig` melempar `ECONOMY_CONFIG_INVALID` untuk SETIAP permintaan, dan | `loadEconomyConfig` dipanggil hampir setiap route. Bentuk kegagalan yang sama sudah pernah | merobohkan produksi lewat migrasi 0027. | Migrasi jalan sebelum kode barunya live (`vercel-build`), jadi urutannya aman: barisnya | dirapikan dulu, aturannya menyusul. | Sengaja `least()`, bukan angka baru: baris yang sudah memenuhi syarat tidak bergeser sama | sekali, jadi ini bukan penyetelan ekonomi melainkan perapian baris yang misinya memang | sudah tidak bisa diselesaikan siapa pun. Plafon 0 dilewati karena di situ misinya tidak | diterbitkan sama sekali (`missions()`), dan `missionAdsTarget` sendiri punya `min: 1`.
update economy_config
set config = config || jsonb_build_object(
  'missionAdsTarget',
  least(
    coalesce((config->>'missionAdsTarget')::numeric, 3),
    coalesce((config->>'adsMaxViewsPerDay')::numeric, 10)
  )::int
)
where id = 1
  and coalesce((config->>'adsMaxViewsPerDay')::numeric, 10) > 0
  and coalesce((config->>'missionAdsTarget')::numeric, 3)
      > coalesce((config->>'adsMaxViewsPerDay')::numeric, 10);
