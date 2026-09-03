import { loadEconomyConfig } from '@/server/economy/economy-config'
import { sanitizeAccountNumber } from '@/domain/economy/withdrawal'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { notifyWithdrawalRequested } from '@/server/messaging/notify'
import { createPayout, getPayouts, PayoutError } from '@/server/payout/payout'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'
import { formatCredits } from '@/shared/lib/format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`withdrawals:${user.id}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    return Response.json(await getPayouts(user.id), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}

const MESSAGE: Record<string, string> = {
  WITHDRAWAL_ALREADY_PENDING: 'Penarikan sebelumnya masih diproses.',
  BELOW_MINIMUM: 'Jumlahnya di bawah batas minimum.',
  INSUFFICIENT_BALANCE: 'Saldo kamu nggak cukup.',
  INVALID_CHANNEL: 'Tujuan transfer nggak dikenal.',
  ABOVE_MAXIMUM: 'Jumlahnya melewati batas maksimum.',
  ACCOUNT_NUMBER_IN_USE: 'Nomor ini dipakai akun lain. Pakai nomor kamu sendiri.',
}

/** Angka syarat dan jeda tidak ditulis di dalam kalimat: keduanya aturan yang bisa berbeda per user — jeda premium 3 hari, biasa 7 — dan salinan di teks pernah membuat pembeli premium diberi tahu angka yang salah. Yang dipakai nilai yang ikut dikirim `PayoutError`. */
function messageFor(error: PayoutError): string {
  if (error.code === 'ACTIVE_DAYS_REQUIRED') {
    const required = Number(error.fields?.requiredActiveDays)
    return Number.isFinite(required) && required > 0
      ? `Butuh ${formatCredits(required)} hari aktif buat tarik dana. Selesaikan minimal 1 task per hari aktif.`
      : 'Butuh beberapa hari aktif buat tarik dana.'
  }
  if (error.code === 'ACTIVE_REFERRALS_REQUIRED') {
    const required = Number(error.fields?.requiredActiveReferrals)
    return Number.isFinite(required) && required > 0
      ? `Butuh ${formatCredits(required)} referral aktif buat tarik dana.`
      : 'Butuh beberapa referral aktif buat tarik dana.'
  }
  if (error.code === 'WITHDRAWAL_COOLDOWN') {
    return 'Kamu masih dalam masa jeda sejak penarikan terakhir.'
  }
  return MESSAGE[error.code] ?? 'Data penarikannya ada yang salah.'
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
      cooldownDays: created.cooldownDays,
    })

    return Response.json(created, { status: 201 })
  } catch (error) {
    if (error instanceof PayoutError) {
      return apiError(error.code, messageFor(error), error.status, error.fields)
    }
    return handleRouteError(error)
  }
}
