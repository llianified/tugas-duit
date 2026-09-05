import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
    },
  },
  test: {
    environment: 'node',
    /**
     * Berkas uji dijalankan berurutan, bukan paralel.
     *
     * Uji yang menyentuh database memakai fallback preview di `server/db.ts`, dan
     * fallback itu adalah satu instance PGlite di atas **satu direktori** di
     * `os.tmpdir()`. Dua worker Vitest yang membukanya bersamaan membuat PGlite
     * abort di dalam WASM-nya, dan berkas mana yang gagal berpindah-pindah tiap
     * jalan — kegagalan yang terlihat seperti bug pada kode yang diuji, padahal
     * murni rebutan berkas.
     *
     * Dibayar dengan durasi: suite ini kecil dan waktunya habis di boot PGlite,
     * bukan di jumlah berkas. Alternatifnya adalah membuat direktori data bisa
     * disetel lewat env var, dan `server/preview-db.ts` sengaja tidak punya satu
     * pun env var supaya mode preview tidak bisa dipaksa menyala.
     */
    fileParallelism: false,
    /** Database uji dihapus sekali sebelum suite jalan. Lihat berkasnya untuk alasannya — singkatnya, direktori PGlite uji persisten, dan suite yang sudah lama dipakai di satu mesin mulai gagal karena sisa jalan sebelumnya, bukan karena kodenya. */
    globalSetup: ['./tests/reset-preview-db.ts'],
  },
})
