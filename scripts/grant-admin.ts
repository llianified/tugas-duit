import { pool } from '../server/db.ts'

async function main() {
  const args = process.argv.slice(2)
  const revoke = args.includes('--revoke')
  const telegramId = args.find((arg) => !arg.startsWith('--'))

  if (!telegramId) {
    console.error('[grant-admin] pemakaian: pnpm db:grant-admin <telegram_id> [--revoke]')
    process.exit(1)
  }
  if (!/^\d+$/.test(telegramId)) {
    console.error(`[grant-admin] telegram_id harus berupa angka, dapat "${telegramId}"`)
    process.exit(1)
  }

  try {
    const updated = await pool.query<{
      public_id: string
      first_name: string
      username: string | null
      is_admin: boolean
    }>(
      'update users set is_admin=$2,updated_at=now() where telegram_id=$1 returning public_id,first_name,username,is_admin',
      [telegramId, !revoke],
    )

    const user = updated.rows[0]
    if (!user) {
      console.error(
        `[grant-admin] tidak ada user dengan telegram_id ${telegramId}. Minta ia membuka Mini App sekali lebih dulu.`,
      )
      process.exit(1)
    }

    const handle = user.username ? `@${user.username}` : '(tanpa username)'
    console.log(
      `[grant-admin] ${revoke ? 'dicabut dari' : 'diberikan ke'} ${user.first_name} ${handle} · ${user.public_id} · is_admin=${user.is_admin}`,
    )

    const total = await pool.query<{ count: string }>(
      'select count(*) count from users where is_admin',
    )
    console.log(`[grant-admin] total admin sekarang: ${total.rows[0].count}`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[grant-admin] gagal', error)
  process.exit(1)
})
