import { Pool, type PoolClient } from 'pg'
import { env } from './env.ts'
import { previewQuery, previewTransaction } from './preview-db.ts'

export function isPreviewDb(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL
}

/** "Sedang dijalankan sebagai preview yang dilihat manusia", BUKAN sekadar "memakai PGlite". Bedanya penting: `isPreviewDb()` juga true selama `pnpm test`, jadi kalau kelonggaran khusus preview (gerbang channel dilewati, interstitial dimatikan) digantungkan padanya, seluruh suite ikut kehilangan perilaku yang justru sedang diuji — dan tesnya gagal dengan benar. `VITEST` diset runner-nya sendiri, jadi pemisahan ini tidak perlu disetel siapa pun. Sama seperti alasan `preview-db.ts` memisahkan direktori datanya. */
export function isPreviewShell(): boolean {
  return isPreviewDb() && !process.env.VITEST
}

function sslConfig() {
  if (process.env.DATABASE_SSL_NO_VERIFY === 'true') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[db] DATABASE_SSL_NO_VERIFY diabaikan di produksi — verifikasi sertifikat tetap menyala.')
      return { rejectUnauthorized: true }
    }
    console.warn('[db] DATABASE_SSL_NO_VERIFY=true — sertifikat database tidak diverifikasi. Jangan dipakai di produksi.')
    return { rejectUnauthorized: false }
  }
  return { rejectUnauthorized: true }
}

/** Next.js production server di EC2 adalah proses jangka panjang, jadi pool proses dapat dipakai bersama semua request. Endpoint runtime tetap connection pooler Neon (host ber-`-pooler`) agar koneksi backend tetap dibatasi. */
const LONG_LIVED_MAX_CLIENTS = 10

/** Connection pooler Neon memakai transaction pooling: satu koneksi backend dipakai ulang oleh banyak klien. Akibatnya `set` tingkat sesi yang tertinggal dari klien lain — sesi psql/agen yang lupa `reset`, misalnya — ikut terbawa ke request kita. Yang paling mematikan `default_transaction_read_only = on`: seluruh write gagal dengan 25006 tanpa satu baris kode pun berubah, dan `select` tetap jalan sehingga health check ikut menipu. Menaruhnya di startup packet (`options: '-c ...'`) ditolak pooler-nya, jadi satu- satunya jalan adalah menegaskan ulang lewat `set` tiap koneksi baru terbentuk. Murah: sekali per koneksi fisik, bukan per query. */
export function createPool(connectionString: string, max: number): Pool {
  const created = new Pool({ connectionString, max, idleTimeoutMillis: 30_000, ssl: sslConfig() })
  created.on('connect', (client) => {
    client.query('set default_transaction_read_only = off').catch((error: unknown) => {
      console.error('[db] gagal menegaskan mode read-write pada koneksi baru:', error)
    })
  })
  return created
}

const globalForDb = globalThis as unknown as { pool?: Pool }
let localPool: Pool | undefined

function getPool(): Pool {
  const cached = globalForDb.pool ?? localPool
  if (cached) return cached

  const created = createPool(env.databaseUrl, LONG_LIVED_MAX_CLIENTS)

  localPool = created
  if (process.env.NODE_ENV !== 'production') globalForDb.pool = created
  return created
}

export const pool = {
  connect: (): Promise<PoolClient> => getPool().connect(),
  query: <T extends import('pg').QueryResultRow = import('pg').QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => getPool().query<T>(sql, params),
  async end(): Promise<void> {
    const activePool = globalForDb.pool ?? localPool
    if (!activePool) return
    globalForDb.pool = undefined
    localPool = undefined
    await activePool.end()
  },
}

export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isPreviewDb()) return (await previewQuery(sql, params)).rows as T[]
  return (await getPool().query(sql, params)).rows as T[]
}

/** Untuk pernyataan yang jawabannya jumlah baris terpengaruh, bukan isinya — `delete` pembersihan retensi, misalnya. `query()` hanya mengembalikan baris, dan tidak semua tabel punya kolom yang bisa di-`returning` (`rate_limits` dan `used_init_data` berkunci gabungan, tanpa `id`). */
export async function execute(sql: string, params: unknown[] = []): Promise<number> {
  if (isPreviewDb()) return (await previewQuery(sql, params)).rowCount
  return (await getPool().query(sql, params)).rowCount ?? 0
}

export async function transaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  if (isPreviewDb()) {
    return previewTransaction(async (client) => {
      await client.query('begin')
      try {
        const value = await fn(client as unknown as PoolClient)
        await client.query('commit')
        return value
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    })
  }

  const client = await getPool().connect()
  let failure: unknown
  try {
    await client.query('begin')
    /** Hook `connect` di atas menutup mayoritas kasus, tapi di transaction pooling koneksi yang kita pegang sekarang belum tentu backend yang tadi kita `set`. Di dalam `begin` backend-nya pasti terpaku pada satu sesi, jadi di sinilah jaminannya benar-benar bisa ditegakkan — dan otomatis lepas saat commit. */
    await client.query('set transaction read write')
    const value = await fn(client)
    await client.query('commit')
    return value
  } catch (error) {
    failure = error
    try {
      await client.query('rollback')
    } catch (rollbackError) {
      console.error('[db] rollback gagal setelah transaksi gagal:', rollbackError)
    }
    throw error
  } finally {
    if (failure) client.release(failure instanceof Error ? failure : new Error(String(failure)))
    else client.release()
  }
}
