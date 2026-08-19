import { Pool, type PoolClient } from 'pg'
import { env } from './env.ts'
import { previewQuery, previewTransaction } from './preview-db.ts'

export function isPreviewDb(): boolean {
  return process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL
}

function sslConfig() {
  if (env.databaseUrl.includes('.railway.internal')) return undefined
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

const globalForDb = globalThis as unknown as { pool?: Pool }
let localPool: Pool | undefined

function getPool(): Pool {
  const cached = globalForDb.pool ?? localPool
  if (cached) return cached

  const created = new Pool({
    connectionString: env.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: sslConfig(),
  })

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
