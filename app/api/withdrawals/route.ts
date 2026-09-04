import { loadEconomyConfig } from '@/server/economy/economy-config'
import { sanitizeAccountNumber } from '@/domain/economy/withdrawal'
import { apiError, assertNotCrossSite, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { notifyWithdrawalRequested } from '@/server/messaging/notify'
import { createPayout, getPayouts, PayoutError } from '@/server/payout/payout'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'
import { formatCredits } from '@/shared/lib/format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const crossSite = assertNotCrossSite(request)
  if (crossSite) return crossSite
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
  WITHDRAWAL_ALREADY_PENDING: 'Penarikan kamu yang sebelumnya masih diproses. Tunggu itu kelar dulu ya.',
  BELOW_MINIMUM: 'Jumlahnya masih kurang dari batas minimum.',
  INSUFFICIENT_BALANCE: 'Saldo kamu nggak cukup.',
  INVALID_CHANNEL: 'Pilih tujuan transfernya dulu ya.',
  ABOVE_MAXIMUM: 'Jumlahnya kebanyakan, lewat dari batas maksimum.',
  ACCOUNT_NUMBER_IN_USE: 'Nomor ini dipakai akun lain. Pakai nomor kamu sendiri.',
}

/** Angka syarat dan jeda tidak ditulis di dalam kalimat: keduanya aturan yang bisa berbeda per user — jeda premium 3 hari, biasa 7 — dan salinan di teks pernah membuat pembeli premium diberi tahu angka yang salah. Yang dipakai nilai yang ikut dikirim `PayoutError`. */
function messageFor(error: PayoutError): string {
  if (error.code === 'ACTIVE_DAYS_REQUIRED') {
    const required = Number(error.fields?.requiredActiveDays)
    return Number.isFinite(required) && required > 0
      ? `Kamu perlu ${formatCredits(required)} hari aktif dulu. Cukup kerjain 1 soal tiap hari.`
      : 'Kamu perlu beberapa hari aktif dulu sebelum bisa tarik dana.'
  }
  if (error.code === 'ACTIVE_REFERRALS_REQUIRED') {
    const required = Number(error.fields?.requiredActiveReferrals)
    return Number.isFinite(required) && required > 0
      ? `Kamu perlu ${formatCredits(required)} teman yang aktif dulu sebelum bisa tarik dana.`
      : 'Kamu perlu beberapa teman yang aktif dulu sebelum bisa tarik dana.'
  }
  if (error.code === 'WITHDRAWAL_COOLDOWN') {
    return 'Belum bisa tarik lagi. Tunggu jedanya kelar ya.'
  }
  return MESSAGE[error.code] ?? 'Ada data yang belum pas. Cek lagi ya.'
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
      return apiError('VALIDATION_FAILED', 'Datanya belum lengkap. Cek lagi ya.', 400)
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
