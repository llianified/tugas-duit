/**
 * Conventional Commits dengan subjek berbahasa Indonesia.
 *
 * Riwayat repo ini sebelumnya mencampur `feat:`/`chore:` gaya Inggris dengan
 * judul bebas berbahasa Indonesia. Yang dikunci di sini cuma bentuknya —
 * type dan struktur — sementara isinya tetap Indonesia sesuai aturan keras #8
 * di CLAUDE.md. CI hanya memeriksa commit milik PR, jadi riwayat lama
 * dibiarkan apa adanya.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // `subject-case` dimatikan: config-conventional menolak kapital di awal,
    // padahal kalimat Indonesia yang wajar sering dimulai huruf besar.
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      [
        'feat', // fitur baru yang terlihat user
        'fix', // perbaikan bug
        'refactor', // ubah bentuk kode, perilaku sama
        'perf', // percepat tanpa ubah perilaku
        'test', // hanya berkas uji
        'docs', // hanya dokumentasi
        'style', // tampilan/format, bukan logika
        'chore', // dependensi, config, perkakas
        'ci', // pipeline CI
        'db', // migrasi SQL — dipisah karena efeknya permanen di produksi
        'revert',
      ],
    ],
    'header-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 100],
  },
}
