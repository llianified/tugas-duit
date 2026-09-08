import { cleanupInactivePremiumWithdrawals, isWithdrawalPremiumRequired } from '../server/payout/payout-cleanup.ts'
import { pool } from '../server/platform/db.ts'
import { deployDecision } from './deploy-gate.ts'

const deployMode = process.argv.includes('--deploy')

async function main() {
  if (!deployMode) {
    throw new Error('Script cleanup deploy wajib dipanggil dengan --deploy')
  }

  const decision = deployDecision(process.env)
  if (decision.action === 'fail') throw new Error(decision.reason)
  if (decision.action === 'skip') {
    console.log(`[cleanup-premium] dilewati — ${decision.platform}: ${decision.reason}`)
    return
  }

  if (!(await isWithdrawalPremiumRequired())) {
    throw new Error(
      'Setelan "Wajib premium untuk menarik" belum bernilai 1. Aktifkan lewat panel admin sebelum deploy.',
    )
  }

  const cleaned = await cleanupInactivePremiumWithdrawals()
  console.log(`[cleanup-premium] ${cleaned} penarikan direfund dan dihapus`)
}

main()
  .catch((error) => {
    console.error('[cleanup-premium] gagal', error)
    process.exitCode = 1
  })
  .finally(() => pool.end().catch(() => {}))
