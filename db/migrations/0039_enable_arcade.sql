-- Arena kini aktif setelah biaya hadiah, jatah harian, cooldown, dan gerbang iklannya
-- ditinjau. Migrasi terpisah ini diperlukan karena 0038 sengaja menyemainya dalam
-- keadaan mati; mengubah migrasi historis tidak akan memengaruhi database yang sudah
-- menjalankannya. Hanya saklarnya yang berubah — seluruh angka ekonomi lain dipertahankan.
update economy_config
set config = jsonb_set(config, '{arcadeEnabled}', '1'::jsonb, true)
where id = 1;
