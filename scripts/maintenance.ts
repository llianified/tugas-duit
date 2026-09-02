import { pool } from '../server/platform/db.ts'
import { runMaintenance } from '../server/ops/maintenance.ts'

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
