import { readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const DATA_DIR = path.join(os.tmpdir(), 'tugas-duit-preview-db')

type QueryResult = { rows: unknown[]; rowCount: number }
type PgliteInstance = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>
  exec: (sql: string) => Promise<unknown>
}

const INT8_OID = 20
const NUMERIC_OID = 1700

const globalForPreview = globalThis as unknown as { previewDb?: Promise<PgliteInstance> }

async function boot(): Promise<PgliteInstance> {
  const { PGlite } = await import('@electric-sql/pglite')
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto')

  const db = (await PGlite.create({
    dataDir: DATA_DIR,
    extensions: { pgcrypto },
    parsers: {
      [INT8_OID]: (value: string) => value,
      [NUMERIC_OID]: (value: string) => value,
    },
  })) as unknown as PgliteInstance

  await migrate(db)
  console.log('[db] mode preview: Postgres in-process (PGlite) di', DATA_DIR)
  return db
}

async function migrate(db: PgliteInstance): Promise<void> {
  const directory = path.join(process.cwd(), 'db/migrations')
  await db.exec(
    'create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())',
  )
  const applied = new Set(
    ((await db.query('select name from schema_migrations')).rows as { name: string }[]).map(
      (row) => row.name,
    ),
  )
  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) {
    if (applied.has(file)) continue
    await db.exec(await readFile(path.join(directory, file), 'utf8'))
    await db.query('insert into schema_migrations(name) values($1)', [file])
    console.log(`[db] preview migrate ok ${file}`)
  }
}

function getDb(): Promise<PgliteInstance> {
  globalForPreview.previewDb ??= boot()
  return globalForPreview.previewDb
}

let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = queue.then(fn, fn)
  queue = result.catch(() => {})
  return result
}

export async function previewQuery(sql: string, params: unknown[] = []): Promise<QueryResult> {
  const db = await getDb()
  const result = await db.query(sql, params)
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }
}

type PreviewClient = {
  query: (sql: string, params?: unknown[]) => Promise<QueryResult>
  release: () => void
}

export async function previewTransaction<T>(
  fn: (client: PreviewClient) => Promise<T>,
): Promise<T> {
  const db = await getDb()
  return enqueue(async () => {
    const client: PreviewClient = {
      query: async (sql, params) => {
        const result = await db.query(sql, params ?? [])
        return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length }
      },
      release: () => {},
    }
    return fn(client)
  })
}
