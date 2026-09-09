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
  /** Sinyal Render tetap dikenali hanya untuk mencegah jalur deploy otomatis lama berjalan tanpa
   * kepastian. Service Render production sekarang hanya redirect legacy dan tidak memanggil jalur
   * ini; production EC2 menjalankan migrasi manual sebelum build. */
  if (env.RENDER) {
    if (env.IS_PULL_REQUEST === 'true') {
      return {
        action: 'skip',
        platform: 'Render',
        reason: 'IS_PULL_REQUEST=true, ini preview pull request legacy',
      }
    }
    if (env.IS_PULL_REQUEST === 'false') return { action: 'run', platform: 'Render' }
    return {
      action: 'fail',
      reason:
        `RENDER terbaca tapi IS_PULL_REQUEST=${env.IS_PULL_REQUEST ?? '(kosong)'}. ` +
        'Jalur otomatis legacy ditolak karena tidak bisa dipastikan ini deploy produksi atau preview. ' +
        'Production EC2 harus memakai `pnpm db:migrate` manual.',
    }
  }

  return {
    action: 'fail',
    reason:
      'Platform deploy otomatis tidak dikenal — RENDER tidak terbaca di environment. ' +
      'Migrasi otomatis menolak menebak. Production EC2 harus menjalankan `pnpm db:migrate` manual.',
  }
}
