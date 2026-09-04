import { claimChannelBonus } from '@/server/integrations/channel'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL: Record<string, { message: string; status: number }> = {
  disabled: { message: 'Bonus join channel lagi tutup.', status: 409 },
  already_claimed: { message: 'Bonus channel-nya udah pernah kamu ambil.', status: 409 },
  not_member: {
    message: 'Kamu belum terdeteksi join. Join dulu, lalu cek lagi.',
    status: 409,
  },
  unverifiable: {
    message: 'Belum bisa dicek sekarang. Coba lagi sebentar lagi ya.',
    status: 503,
  },
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`channel:claim:${user.id}`, 10, 600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const claimed = await claimChannelBonus(user.id, user.telegramId)
    if (!claimed.ok) {
      const refusal = REFUSAL[claimed.reason]
      return apiError('CHANNEL_CLAIM_REFUSED', refusal.message, refusal.status)
    }

    return Response.json(
      { credits: claimed.credits, balance: claimed.balance },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}
