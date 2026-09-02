import { loadEconomyConfig } from '@/server/economy-config'
import { sanitizeAccountNumber } from '@/domain/withdrawal'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { notifyWithdrawalRequested } from '@/server/notify'
import { createPayout, getPayouts, PayoutError } from '@/server/payout'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'
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
  WITHDRAWAL_ALREADY_PENDING: 'Penarikan kamu yang sebelumnya masih diproses.',
  BELOW_MINIMUM: 'Jumlahnya masih kurang dari batas minimal.',
  INSUFFICIENT_BALANCE: 'Saldo kamu nggak cukup.',
  INVALID_CHANNEL: 'Tujuan transfernya nggak dikenal.',
  ABOVE_MAXIMUM: 'Jumlahnya kelewat besar dari batas maksimal.',
  ACCOUNT_NUMBER_IN_USE: 'Nomor ini udah dipakai akun lain. Pakai nomor punya kamu sendiri ya.',
}

/** Angka syarat dan jeda tidak ditulis di dalam kalimat: keduanya aturan yang bisa berbeda per user — jeda premium 3 hari, biasa 7 — dan salinan di teks pernah membuat pembeli premium diberi tahu angka yang salah. Yang dipakai nilai yang ikut dikirim `PayoutError`. */
function messageFor(error: PayoutError): string {
  if (error.code === 'ACTIVE_DAYS_REQUIRED') {
    const required = Number(error.fields?.requiredActiveDays)
    return Number.isFinite(required) && required > 0
      ? `Kamu perlu ${formatCredits(required)} hari aktif sebelum bisa tarik dana. Satu hari kehitung aktif kalau ada minimal 1 task yang kelar.`
      : 'Kamu perlu beberapa hari aktif dulu sebelum bisa tarik dana.'
  }
  if (error.code === 'ACTIVE_REFERRALS_REQUIRED') {
    const required = Number(error.fields?.requiredActiveReferrals)
    return Number.isFinite(required) && required > 0
      ? `Kamu perlu ${formatCredits(required)} referral aktif sebelum bisa tarik dana.`
      : 'Kamu perlu beberapa referral aktif sebelum bisa tarik dana.'
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
