import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createPool } from '../server/platform/db.ts'
import { env } from '../server/platform/env.ts'
import { deployDecision } from './deploy-gate.ts'

const directory = path.join(process.cwd(), 'db/migrations')

const LOCK_KEY = 8_421_207

// Neon menidurkan compute yang menganggur, jadi koneksi pertama setelah jeda panjang | sering gagal cuma karena endpoint-nya baru bangun.
const CONNECT_ATTEMPTS = 5
const RETRYABLE = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'])

/** Dipanggil dengan `--deploy` dari `deploy-build`, dan di situ ia HANYA boleh jalan untuk deploy Production. Aturan platformnya di `deploy-gate.ts`; yang tinggal di sini cuma cara menjawabnya. `pnpm db:migrate` manual tidak membawa flag ini dan tetap jalan apa adanya. */
const deployMode = process.argv.includes('--deploy')

if (deployMode) {
  const decision = deployDecision(process.env)

  if (decision.action === 'fail') {
    console.error(`[migrate] ${decision.reason}`)
    process.exit(1)
  }

  if (decision.action === 'skip') {
    console.log(`[migrate] dilewati — ${decision.platform}: ${decision.reason}`)
    process.exit(0)
  }

  /** Dicetak justru saat migrasi JADI jalan. Perpindahan platform hanya bisa dibuktikan dari log
   * build pertama: baris inilah yang menunjukkan Render benar-benar mengekspor sinyalnya saat
   * build, bukan cuma saat runtime. */
  console.log(`[migrate] platform ${decision.platform}, deploy produksi — migrasi dijalankan`)
}

/** Di jalur otomatis endpoint langsung tidak boleh ditebak. `databaseUrlForMigrations` sengaja jatuh ke DATABASE_URL kalau yang unpooled tidak ada, dan itu benar untuk pemakaian manual — tapi DATABASE_URL dari integrasi Neon–Vercel adalah endpoint POOLED, dan `pg_advisory_lock` di pooler mode transaksi tidak menjamin apa pun. Lebih baik build-nya gagal berisik daripada dua deploy bersamaan memigrasi tanpa kunci yang benar-benar memegang. */
if (deployMode && !process.env.DATABASE_URL_UNPOOLED?.trim()) {
  console.error(
    '[migrate] DATABASE_URL_UNPOOLED belum diset di environment Production. Migrasi otomatis butuh endpoint langsung (tanpa -pooler), bukan yang pooled.',
  )
  process.exit(1)
}

const pool = createPool(env.databaseUrlForMigrations, 1)

function isRetryable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && RETRYABLE.has(code)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function connectWithRetry() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await pool.connect()
    } catch (error) {
      if (attempt >= CONNECT_ATTEMPTS || !isRetryable(error)) throw error
      const delay = 500 * 2 ** (attempt - 1)
      const code = (error as { code?: string }).code
      console.warn(`[migrate] database belum siap (${code}), coba lagi ${attempt}/${CONNECT_ATTEMPTS - 1} dalam ${delay}ms`)
      await sleep(delay)
    }
  }
}

async function main() {
  const client = await connectWithRetry()
  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY])
    try {
      await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`)
      const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
      const applied = new Set((await client.query<{ name: string }>('select name from schema_migrations')).rows.map((row) => row.name))
      for (const file of files) {
        if (applied.has(file)) continue
        await client.query('begin')
        try {
          await client.query(await readFile(path.join(directory, file), 'utf8'))
          await client.query('insert into schema_migrations(name) values($1)', [file])
          await client.query('commit')
          console.log(`[migrate] ok ${file}`)
        } catch (error) {
          await client.query('rollback')
          throw error
        }
      }
    } finally {
      await client.query('select pg_advisory_unlock($1)', [LOCK_KEY])
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(async (error) => {
  console.error('[migrate] gagal', error)
  try {
    await pool.end()
  } catch {
    // pool mungkin belum pernah terbentuk; abaikan.
  }
  process.exit(1)
})
