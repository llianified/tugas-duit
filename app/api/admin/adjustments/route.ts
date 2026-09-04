import { loadEconomyConfig } from '@/server/economy/economy-config'
import { maxPayoutCredits } from '@/domain/economy/economy'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { recordAdjustment } from '@/server/economy/ledger'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ADJUSTMENT_NOTE_MAX = 280

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:adjustments:${admin.id}`, 30, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = (await request.json().catch(() => null)) as {
      userId?: string
      credits?: number
      note?: string
      requestId?: string
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

    /** Kunci idempotensi dibuat klien saat formulirnya dibuka, bukan server saat permintaannya
     * mendarat — lihat `recordAdjustment`. Tanpa itu klik ganda mencetak koreksi kedua senilai
     * penuh, dan ledger yang append-only mencatat keduanya selamanya. */
    const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
    if (!UUID_SHAPE.test(requestId)) {
      return apiError('VALIDATION_FAILED', 'Muat ulang halamannya, lalu ulangi koreksinya.', 400)
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
      requestId,
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
