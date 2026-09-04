import { isArcadeGame } from '@/domain/arcade/arcade'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import {
  apiError,
  assertSameOrigin,
  handleRouteError,
  rateLimited,
  readJsonBody,
} from '@/server/platform/http'
import { openArcadePlay } from '@/server/arcade/arcade'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Satu pesan per sebab, karena obatnya berbeda-beda. `cooldown` lewat sendiri dalam hitungan menit, `daily_cap` baru lepas besok, dan `nothing_to_win` justru kabar baik yang terdengar seperti penolakan — stok dan energi sama-sama penuh, jadi tidak ada yang bisa ditambah. Menyatukannya jadi satu kalimat membuat user menunggu sesuatu yang tidak akan datang, kesalahan yang sama yang dihindari `QuotaRefusal`. */
const REFUSAL: Record<string, { message: string; status: number }> = {
  arcade_disabled: { message: 'Arena lagi tutup.', status: 409 },
  play_open: { message: 'Masih ada ronde yang belum kelar. Selesaikan dulu.', status: 409 },
  daily_cap: { message: 'Jatah main hari ini udah habis. Balik lagi besok ya.', status: 409 },
  cooldown: { message: 'Belum boleh main lagi. Tunggu jedanya kelar.', status: 409 },
  no_ad_pass: { message: 'Tonton iklannya dulu buat dapat satu kali main.', status: 409 },
  nothing_to_win: {
    message: 'Stok dan energi kamu lagi penuh, jadi nggak ada yang bisa ditambah. Pakai dulu, baru main.',
    status: 409,
  },
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`arcade:open:${user.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ game?: unknown }>(request)
    if (!isArcadeGame(body?.game)) {
      return apiError('ARCADE_UNKNOWN_GAME', 'Permainannya nggak ketemu. Muat ulang dulu ya.', 400)
    }

    const opened = await openArcadePlay(user.id, body.game)
    if (!opened.ok) {
      const refusal = REFUSAL[opened.reason]
      return apiError('ARCADE_OPEN_REFUSED', refusal.message, refusal.status)
    }

    return Response.json(opened, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
