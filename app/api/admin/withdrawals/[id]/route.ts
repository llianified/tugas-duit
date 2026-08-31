import { loadEconomyConfig } from '@/server/economy-config'
import { WITHDRAWAL_REJECT_REASON_MAX } from '@/features/withdraw/domain'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { notifyWithdrawalPaid, notifyWithdrawalRejected } from '@/server/notify'
import { PayoutError, savePayoutProof, settlePayout } from '@/server/payout'
import { readPayoutProof, type PayoutProof } from '@/server/payout-proof'
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
    const contentType = request.headers.get('content-type') ?? ''
    let body: { action?: 'paid' | 'rejected'; note?: string; reason?: string } | null = null
    let proof: PayoutProof | undefined

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData().catch(() => null)
      if (!form) return apiError('VALIDATION_FAILED', 'Body tidak valid.', 400)

      const action = form.get('action')
      body = {
        action: action === 'paid' || action === 'rejected' ? action : undefined,
        note: typeof form.get('note') === 'string' ? String(form.get('note')) : undefined,
        reason: typeof form.get('reason') === 'string' ? String(form.get('reason')) : undefined,
      }

      const file = form.get('proof')
      if (file instanceof File) {
        if (body.action !== 'paid') {
          return apiError('VALIDATION_FAILED', 'Bukti transfer hanya untuk penarikan yang dibayar.', 400)
        }
        const read = await readPayoutProof(file)
        if (!read.ok) return apiError('VALIDATION_FAILED', read.message, 400)
        proof = read.proof
      }
    } else {
      body = (await request.json().catch(() => null)) as typeof body
    }

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

    if (body.action === 'paid') {
      const fileId = await notifyWithdrawalPaid(settled.notice, proof)
      if (fileId) await savePayoutProof(id, fileId)
    } else {
      await notifyWithdrawalRejected({ ...settled.notice, reason })
    }

    return Response.json({ withdrawal: settled.withdrawal })
  } catch (error) {
    if (error instanceof PayoutError) {
      return apiError(error.code, MESSAGE[error.code] ?? 'Pengajuan tidak bisa diproses.', error.status)
    }
    return handleRouteError(error)
  }
}
