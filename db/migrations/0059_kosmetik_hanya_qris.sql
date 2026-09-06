-- Kosmetik hanya dibayar QRIS, tidak pernah ditebus TD.
--
-- Migrasi 0058 menyemai `storeFramePriceCredits` dan `storeTitlePriceCredits`, dan itu keputusan
-- yang dibatalkan pemilik repo sebelum raknya sempat dipakai. Alasannya bukan besaran harganya
-- melainkan ARAHNYA: setiap barang lain di rak menyerap saldo — TD masuk, liabilitas berkurang —
-- sementara kosmetik satu-satunya yang tidak menyentuh ekonomi sama sekali. Dijual lewat QRIS ia
-- pemasukan bersih; dijual lewat TD ia cuma menukar liabilitas dengan barang yang seharusnya
-- dibayar tunai.
--
-- Dua key itu dicabut dari baris, bukan dibiarkan menganggur. Syaratnya keras dan diuji:
-- `server/economy/economy-config.test.ts` menuntut baris yang disemai migrasi SAMA PERSIS dengan
-- `DEFAULT_ECONOMY_CONFIG`, jadi key yang hilang dari kode tapi tertinggal di baris membuat
-- pemeriksaan itu gagal. Bentuknya mengikuti migrasi 0053, yang mencabut key reward misi X dengan
-- alasan yang sama.
--
-- Operator `-` pada jsonb menghapus key kalau ada dan tidak melakukan apa pun kalau tidak — jadi
-- migrasi ini aman dijalankan di baris yang sudah bersih maupun yang belum.
update economy_config
set config = config - 'storeFramePriceCredits' - 'storeTitlePriceCredits'
where id = 1;

-- Yang TIDAK diubah: `store_purchases_known_item` tetap menyebut sebelas key termasuk kosmetik.
-- Menyempitkannya berarti `add constraint` memvalidasi ulang seluruh baris yang ada, dan satu saja
-- pembelian kosmetik lewat TD yang telanjur tercatat akan menggagalkan migrasi di produksi — yang
-- berarti menghentikan deploy, persis jebakan yang dicatat migrasi 0053. Yang menutup jalurnya
-- katalog di domain: kosmetik tidak punya `priceCredits`, jadi `buyStoreItem` menolaknya dengan
-- `payment_unavailable` sebelum satu credit pun disentuh. Constraint yang lebih longgar daripada
-- kode bukan celah — ia cuma tidak ikut menegakkan aturan yang sudah ditegakkan di atasnya.
