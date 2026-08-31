import { loadEconomyConfig } from '@/server/economy-config'
import { WITHDRAWAL_REJECT_REASON_MAX } from '@/features/withdraw/domain'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { notifyWithdrawalPaid, notifyWithdrawalRejected } from '@/server/notify'
import { PayoutError, settlePayout } from '@/server/payout'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE: Record<string, string> = {
  ALREADY_SETTLED: 'Pengajuan sudah diproses.',
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:withdrawal-settle:${admin.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const { id } = await params
    const body = (await request.json().catch(() => null)) as {
      action?: 'paid' | 'rejected'
      note?: string
      reason?: string
    } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Body tidak valid.', 400)
    }
    if (body.action !== 'paid' && body.action !== 'rejected') {
      return apiError('VALIDATION_FAILED', 'Aksi tidak valid.', 400)
    }
    const reason = body.reason?.trim() ?? ''
    if (body.action === 'rejected' && (!reason || reason.length > WITHDRAWAL_REJECT_REASON_MAX)) {
      return apiError(
        'VALIDATION_FAILED',
        `Alasan penolakan wajib diisi, maksimum ${WITHDRAWAL_REJECT_REASON_MAX} karakter.`,
        400,
      )
    }

    const settled = await settlePayout(admin.id, id, body.action, reason, body.note ?? null)
    if (!settled) return new Response(null, { status: 404 })

    if (body.action === 'paid') await notifyWithdrawalPaid(settled.notice)
    else await notifyWithdrawalRejected({ ...settled.notice, reason })

    return Response.json({ withdrawal: settled.withdrawal })
  } catch (error) {
    if (error instanceof PayoutError) {
      return apiError(error.code, MESSAGE[error.code] ?? 'Pengajuan tidak bisa diproses.', error.status)
    }
    return handleRouteError(error)
  }
}
