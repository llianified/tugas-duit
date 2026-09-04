import { apiError, assertNotCrossSite, handleRouteError, rateLimited } from '@/server/platform/http'
import { readPayoutProofFileId } from '@/server/payout/payout'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'
import { readTelegramFile } from '@/server/integrations/telegram'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const site = assertNotCrossSite(request)
  if (site) return site
  try {
    const user = await requireUser()
    const limit = await checkRateLimit(`withdrawal-proof:${user.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const { id } = await params
    if (!UUID_SHAPE.test(id)) return new Response(null, { status: 404 })

    const fileId = await readPayoutProofFileId(user.id, id)
    if (!fileId) return new Response(null, { status: 404 })

    const file = await readTelegramFile(fileId)
    if (!file) {
      return apiError('PROOF_UNAVAILABLE', 'Bukti transfernya belum bisa dibuka. Coba lagi ya.', 502)
    }

    return new Response(file.bytes as unknown as BodyInit, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.bytes.byteLength),
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline; filename="bukti-transfer"',
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
