-- Turbo Reward adalah flag komunikasi UI, bukan besaran reward baru. Nilai 1 membuat
-- konfigurasi produksi lama langsung menampilkan event setelah deploy, sementara
-- penggabungan dari kiri menjaga nilai 0/1 yang mungkin sudah ada agar tidak ditimpa.
update economy_config
set config = jsonb_build_object('turboRewardEnabled', 1) || config
where id = 1;
