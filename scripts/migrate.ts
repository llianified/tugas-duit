import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pool } from '../server/db.ts'

const directory = path.join(process.cwd(), 'db/migrations')

const LOCK_KEY = 8_421_207

async function main() {
  const client = await pool.connect()
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

main().catch((error) => {
  console.error('[migrate] gagal', error)
  process.exit(1)
})
