import { readdir, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** Direktori data dipisah per pemakai. Uji juga jatuh ke PGlite (mereka menghapus `DATABASE_URL` lalu mengimpor `./db`), dan selama direktorinya sama dengan yang dipakai `pnpm dev`, satu kali `pnpm test` menulis ratusan user uji ke database preview yang sedang dipakai mengembangkan — saldo, task, dan penarikan yang terlihat di layar dev jadi campuran keduanya. `VITEST` diset runner-nya sendiri, jadi pemisahannya tidak perlu disetel siapa pun. */
const DATA_DIR = path.join(
  os.tmpdir(),
  process.env.VITEST ? 'tugas-duit-test-db' : 'tugas-duit-preview-db',
)

type QueryResult = { rows: unknown[]; rowCount: number }
type PgliteInstance = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>
  exec: (sql: string) => Promise<unknown>
}

const INT8_OID = 20
const NUMERIC_OID = 1700

const globalForPreview = globalThis as unknown as {
  previewDb?: Promise<PgliteInstance>
  previewFeaturesConfigured?: Promise<void>
}

/** Preview manusia harus selalu membuka seluruh permukaan produk yang sedang ditinjau. Nilai
 * ini ditulis ke PGlite, bukan dioverride di respons sesi, supaya API Arena dan UI membaca
 * sumber konfigurasi yang sama. Uji dikecualikan karena masing-masing skenario mengatur flag
 * ekonominya sendiri. Promise disimpan di `globalThis` agar Fast Refresh tidak menjalankan
 * update yang sama berulang kali pada database preview yang persisten. */
async function configurePreviewFeatures(db: PgliteInstance): Promise<void> {
  await db.exec(`
    update economy_config
       set config = jsonb_set(config, '{arcadeEnabled}', '1'::jsonb, true)
     where id = 1
  `)
}

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

async function getDb(): Promise<PgliteInstance> {
  globalForPreview.previewDb ??= boot()
  const db = await globalForPreview.previewDb
  if (!process.env.VITEST) {
    globalForPreview.previewFeaturesConfigured ??= configurePreviewFeatures(db)
    await globalForPreview.previewFeaturesConfigured
  }
  return db
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
