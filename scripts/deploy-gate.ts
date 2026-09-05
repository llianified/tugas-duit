/** Penjaga migrasi otomatis untuk jalur `--deploy`.
 *
 * Dipisah dari `scripts/migrate.ts` supaya keputusannya bisa diuji tanpa menyentuh database:
 * berkas itu membuka pool dan menjalankan migrasi begitu diimpor, jadi satu-satunya cara menguji
 * penjaganya adalah dengan tidak mengimpornya.
 *
 * Aturannya satu kalimat: migrasi otomatis hanya jalan untuk deploy PRODUKSI, dan kalau jawabannya
 * tidak bisa dipastikan ia harus BERISIK — bukan dilewati diam-diam. Bentuk lamanya cuma memeriksa
 * `VERCEL_ENV`, jadi di platform mana pun selain Vercel ia keluar dengan status 0 sambil melaporkan
 * sukses. Kode baru live di atas skema lama dan tidak ada satu pun pesan yang memberitahu; build
 * hijau, deploy hijau, dan yang pertama tahu adalah user yang layarnya error. Itu mode kegagalan
 * paling mahal di repo ini justru karena ia tidak terlihat di mana pun.
 */

export type DeployDecision =
  | { action: 'run'; platform: string }
  | { action: 'skip'; platform: string; reason: string }
  | { action: 'fail'; reason: string }

/** Baca dari objek yang dikirim, bukan dari `process.env` langsung, supaya tiap cabang bisa diuji. */
export function deployDecision(env: Record<string, string | undefined>): DeployDecision {
  /** Vercel menjalankan build di SETIAP deploy, termasuk Preview. Tanpa penjaga ini setiap branch
   * setengah jadi akan memigrasi database produksi. */
  if (env.VERCEL) {
    if (env.VERCEL_ENV === 'production') return { action: 'run', platform: 'Vercel' }
    return {
      action: 'skip',
      platform: 'Vercel',
      reason: `VERCEL_ENV=${env.VERCEL_ENV ?? '(kosong)'}, bukan production`,
    }
  }

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
      'Platform deploy tidak dikenal — VERCEL maupun RENDER tidak terbaca di environment. ' +
      'Migrasi otomatis menolak menebak. Jalankan `pnpm db:migrate` manual, atau tambahkan ' +
      'platformnya ke scripts/deploy-gate.ts.',
  }
}
