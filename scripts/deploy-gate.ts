/** Penjaga migrasi otomatis untuk jalur `--deploy`.
 *
 * Dipisah dari `scripts/migrate.ts` supaya keputusannya bisa diuji tanpa menyentuh database:
 * berkas itu membuka pool dan menjalankan migrasi begitu diimpor, jadi satu-satunya cara menguji
 * penjaganya adalah dengan tidak mengimpornya.
 *
 * Aturannya satu kalimat: migrasi otomatis hanya jalan untuk deploy PRODUKSI, dan kalau jawabannya
 * tidak bisa dipastikan ia harus BERISIK — bukan dilewati diam-diam. Dengan begitu kode tidak bisa
 * live di atas skema lama sementara build melaporkan sukses.
 */

export type DeployDecision =
  | { action: 'run'; platform: string }
  | { action: 'skip'; platform: string; reason: string }
  | { action: 'fail'; reason: string }

/** Baca dari objek yang dikirim, bukan dari `process.env` langsung, supaya tiap cabang bisa diuji. */
export function deployDecision(env: Record<string, string | undefined>): DeployDecision {
  /** Render memakai `IS_PULL_REQUEST` untuk membedakan preview dari service sungguhan. Nilai yang
   * tidak terbaca sengaja MENGGAGALKAN build, bukan diasumsikan salah satunya: menebak `false`
   * berarti preview pull request boleh memigrasi database produksi, dan menebak `true` berarti
   * deploy produksi berhenti memigrasi tanpa ada yang tahu. Dua-duanya lebih buruk daripada build
   * yang gagal sambil menyebut persis apa yang harus disetel. */
  if (env.RENDER) {
    if (env.IS_PULL_REQUEST === 'true') {
      return {
        action: 'skip',
        platform: 'Render',
        reason: 'IS_PULL_REQUEST=true, ini preview pull request',
      }
    }
    if (env.IS_PULL_REQUEST === 'false') return { action: 'run', platform: 'Render' }
    return {
      action: 'fail',
      reason:
        `RENDER terbaca tapi IS_PULL_REQUEST=${env.IS_PULL_REQUEST ?? '(kosong)'}. ` +
        'Migrasi tidak dijalankan karena tidak bisa dipastikan ini deploy produksi atau preview. ' +
        'Setel IS_PULL_REQUEST=false di environment service kalau Render tidak mengekspornya saat build.',
    }
  }

  return {
    action: 'fail',
    reason:
      'Platform deploy tidak dikenal — RENDER tidak terbaca di environment. ' +
      'Migrasi otomatis menolak menebak. Jalankan `pnpm db:migrate` manual, atau periksa ' +
      'environment build Render.',
  }
}
