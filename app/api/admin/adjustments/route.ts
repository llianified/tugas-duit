import { loadEconomyConfig } from '@/server/economy-config'
import { maxPayoutCredits } from '@/domain/economy'
import { apiError, assertSameOrigin, handleRouteError } from '@/server/http'
import { recordAdjustment } from '@/server/ledger'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADJUSTMENT_NOTE_MAX = 280

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })

    const body = (await request.json().catch(() => null)) as {
      userId?: string
      credits?: number
      note?: string
    } | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Body tidak valid.', 400)
    }

    if (typeof body.userId !== 'string' || !body.userId.trim()) {
      return apiError('VALIDATION_FAILED', 'userId (public_id) wajib diisi.', 400)
    }
    const credits = body.credits
    if (typeof credits !== 'number' || !Number.isSafeInteger(credits) || credits === 0) {
      return apiError('VALIDATION_FAILED', 'credits harus bilangan bulat bukan nol.', 400)
    }
    if (Math.abs(credits) > maxPayoutCredits()) {
      return apiError('VALIDATION_FAILED', 'credits melebihi batas koreksi.', 400)
    }

    const note = body.note?.trim() ?? ''
    if (!note || note.length > ADJUSTMENT_NOTE_MAX) {
      return apiError(
        'VALIDATION_FAILED',
        `Catatan wajib diisi, maksimum ${ADJUSTMENT_NOTE_MAX} karakter.`,
        400,
      )
    }

    const result = await recordAdjustment({
      adminId: admin.id,
      adminName: admin.firstName,
      userPublicId: body.userId.trim(),
      credits,
      note,
    })
    if (!result) return new Response(null, { status: 404 })

    return Response.json({ balance: result.balance, ledgerId: result.ledgerId })
  } catch (error) {
    if ((error as { code?: string }).code === '23514') {
      return apiError('BALANCE_WOULD_GO_NEGATIVE', 'Koreksi membuat saldo user negatif.', 400)
    }
    return handleRouteError(error)
  }
}
