import { pool } from '../server/db.ts'
import { runMaintenance } from '../server/maintenance.ts'

main()

async function main() {
  try {
    await runMaintenance()
  } catch (error) {
    console.error('[maintenance] gagal', error)
    await pool.end().catch(() => {})
    process.exit(1)
  }
  await pool.end()
}
