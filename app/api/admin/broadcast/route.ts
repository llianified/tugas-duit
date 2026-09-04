import { BROADCAST_BODY_MAX, isBroadcastSegment } from '@/domain/messaging/broadcast'
import { countBroadcastRecipients, createBroadcast, runBroadcast } from '@/server/messaging/broadcast'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited, readJsonBody } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Tiga aksi di satu route karena ketiganya satu alur yang harus dijalani berurutan: hitung penerimanya, buat siarannya, lalu kirim per putaran sampai habis. `preview` sengaja tidak menulis apa pun. Ia memakai query yang persis sama dengan yang mengirim, jadi angka yang dilihat admin sebelum menekan kirim adalah angka yang benar — bukan perkiraan dari query lain yang bisa menyimpang diam-diam. */
export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:broadcast:${admin.id}`, 120, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{
      action?: unknown
      segment?: unknown
      body?: unknown
      broadcastId?: unknown
    }>(request)
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Data yang dikirim nggak kebaca.', 400)
    }

    if (body.action === 'preview') {
      if (!isBroadcastSegment(body.segment)) {
        return apiError('VALIDATION_FAILED', 'Segmen tidak dikenal.', 400)
      }
      return Response.json({ recipients: await countBroadcastRecipients(body.segment) })
    }

    if (body.action === 'create') {
      if (!isBroadcastSegment(body.segment)) {
        return apiError('VALIDATION_FAILED', 'Segmen tidak dikenal.', 400)
      }
      const text = typeof body.body === 'string' ? body.body.trim() : ''
      if (!text || text.length > BROADCAST_BODY_MAX) {
        return apiError(
          'VALIDATION_FAILED',
          `Isi pesan wajib diisi, maksimum ${BROADCAST_BODY_MAX} karakter.`,
          400,
        )
      }
      const created = await createBroadcast(body.segment, text)
      return Response.json(created)
    }

    if (body.action === 'send') {
      if (typeof body.broadcastId !== 'string' || !body.broadcastId) {
        return apiError('VALIDATION_FAILED', 'Siaran tidak dikenal.', 400)
      }
      return Response.json(await runBroadcast(body.broadcastId))
    }

    return apiError('VALIDATION_FAILED', 'Aksinya nggak dikenali.', 400)
  } catch (error) {
    if (error instanceof Error && error.message === 'BROADCAST_NOT_FOUND') {
      return apiError('BROADCAST_NOT_FOUND', 'Siaran itu tidak ditemukan.', 404)
    }
    if (error instanceof Error && error.message === 'BROADCAST_BODY_INVALID') {
      return apiError('VALIDATION_FAILED', 'Isi pesannya tidak valid.', 400)
    }
    return handleRouteError(error)
  }
}
