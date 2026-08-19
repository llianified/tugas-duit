import { pool, transaction } from '../server/db.ts'

const REASON_MAX_LENGTH = 500

function usage(): never {
  console.error(
    '[ban-user] pemakaian: pnpm db:ban-user <telegram_id> --reason "alasan" | pnpm db:ban-user <telegram_id> --revoke',
  )
  process.exit(1)
}

async function main() {
  const args = process.argv.slice(2)
  const revoke = args.includes('--revoke')
  const reasonIndex = args.indexOf('--reason')
  const reason = reasonIndex >= 0 ? args[reasonIndex + 1]?.trim() : undefined
  const telegramId = args.find((arg, index) => {
    const isReasonValue = reasonIndex >= 0 && index === reasonIndex + 1
    return !arg.startsWith('--') && !isReasonValue
  })

  if (!telegramId) usage()
  if (!/^\d+$/.test(telegramId)) {
    console.error(`[ban-user] telegram_id harus berupa angka, dapat "${telegramId}"`)
    process.exit(1)
  }
  if (!revoke && !reason) {
    console.error('[ban-user] alasan wajib diisi saat memban akun.')
    usage()
  }
  if (reason && reason.length > REASON_MAX_LENGTH) {
    console.error(`[ban-user] alasan maksimum ${REASON_MAX_LENGTH} karakter.`)
    process.exit(1)
  }

  try {
    const result = await transaction(async (tx) => {
      const updated = await tx.query<{
        id: string
        public_id: string
        first_name: string
        username: string | null
        banned_at: Date | null
        ban_reason: string | null
      }>(
        revoke
          ? `update users
             set banned_at=null,ban_reason=null,updated_at=now()
             where telegram_id=$1
             returning id,public_id,first_name,username,banned_at,ban_reason`
          : `update users
             set banned_at=now(),ban_reason=$2,updated_at=now()
             where telegram_id=$1
             returning id,public_id,first_name,username,banned_at,ban_reason`,
        revoke ? [telegramId] : [telegramId, reason],
      )

      const user = updated.rows[0]
      if (!user) throw new Error(`USER_NOT_FOUND:${telegramId}`)

      let revokedSessions = 0
      if (!revoke) {
        const revoked = await tx.query(
          'update sessions set revoked_at=now() where user_id=$1 and revoked_at is null',
          [user.id],
        )
        revokedSessions = revoked.rowCount ?? 0
      }

      return { user, revokedSessions }
    })

    const handle = result.user.username ? `@${result.user.username}` : '(tanpa username)'
    console.log(
      `[ban-user] akun ${revoke ? 'dipulihkan' : 'ditangguhkan'}: ${result.user.first_name} ${handle} · ${result.user.public_id}`,
    )
    if (!revoke) {
      console.log(`[ban-user] sesi aktif yang dicabut: ${result.revokedSessions}`)
    }

    const total = await pool.query<{ count: string }>(
      'select count(*) count from users where banned_at is not null',
    )
    console.log(`[ban-user] total akun ditangguhkan sekarang: ${total.rows[0].count}`)
  } catch (error) {
    if (error instanceof Error && error.message === `USER_NOT_FOUND:${telegramId}`) {
      console.error(
        `[ban-user] tidak ada user dengan telegram_id ${telegramId}. User harus membuka Mini App sekali lebih dulu.`,
      )
      process.exitCode = 1
      return
    }
    throw error
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[ban-user] gagal', error)
  process.exit(1)
})
