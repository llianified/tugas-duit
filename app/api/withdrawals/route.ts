import { loadEconomyConfig } from '@/server/economy-config'
import { sanitizeAccountNumber } from '@/features/withdraw/domain'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { notifyWithdrawalRequested } from '@/server/notify'
import { createPayout, getPayouts, PayoutError } from '@/server/payout'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    return Response.json(await getPayouts(user.id))
  } catch (error) {
    return handleRouteError(error)
  }
}

const MESSAGE: Record<string, string> = {
  WITHDRAWAL_ALREADY_PENDING: 'Penarikan kamu yang sebelumnya masih diproses.',
  BELOW_MINIMUM: 'Jumlahnya masih kurang dari batas minimal.',
  INSUFFICIENT_BALANCE: 'Saldo kamu nggak cukup.',
  INVALID_CHANNEL: 'Tujuan transfernya nggak dikenal.',
  ABOVE_MAXIMUM: 'Jumlahnya kelewat besar dari batas maksimal.',
  ACCOUNT_NUMBER_IN_USE: 'Nomor ini udah dipakai akun lain. Pakai nomor punya kamu sendiri ya.',
  ACTIVE_REFERRALS_REQUIRED: 'Kamu perlu 5 referral aktif sebelum bisa tarik dana.',
  WITHDRAWAL_COOLDOWN: 'Kamu masih dalam cooldown 7 hari sejak penarikan terakhir.',
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (
      !raw ||
      Array.isArray(raw) ||
      typeof raw.channelId !== 'string' ||
      typeof raw.accountNumber !== 'string' ||
      typeof raw.accountName !== 'string' ||
      typeof raw.credits !== 'number' ||
      !Number.isInteger(raw.credits)
    ) {
      return apiError('VALIDATION_FAILED', 'Data penarikannya belum lengkap.', 400)
    }

    const limit = await checkRateLimit(`withdraw:${user.id}`, 5, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = {
      channelId: raw.channelId,
      accountNumber: raw.accountNumber,
      accountName: raw.accountName,
      credits: raw.credits,
    }
    const created = await createPayout(user.id, body)

    await notifyWithdrawalRequested({
      telegramId: user.telegramId,
      channelId: body.channelId,
      accountNumber: sanitizeAccountNumber(body.accountNumber),
      accountName: body.accountName.trim(),
      credits: created.withdrawal.credits,
      amountIdr: created.withdrawal.amountIdr,
    })

    return Response.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof PayoutError) {
      return apiError(
        error.code,
        MESSAGE[error.code] ?? 'Data penarikannya ada yang salah.',
        error.status,
        error.fields,
      )
    }
    return handleRouteError(error)
  }
}
