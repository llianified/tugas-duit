import { loadEconomyConfig } from '@/server/economy/economy-config'
import {
  apiError,
  assertSameOrigin,
  handleRouteError,
  rateLimited,
  readJsonBody,
} from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { buyStoreItem } from '@/server/store/store'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL: Record<string, { message: string; status: number }> = {
  store_disabled: { message: 'Tokonya lagi tutup.', status: 409 },
  unknown_item: { message: 'Barangnya nggak ketemu. Muat ulang dulu ya.', status: 400 },
  insufficient_balance: { message: 'Saldo TD kamu belum cukup buat beli ini.', status: 409 },
  energy_full: { message: 'Energi kamu bakal kelebihan. Pakai dulu, terus beli lagi.', status: 409 },
  /** Menyebut yang ditakutkan lalu menenangkan: yang dikhawatirkan bukan tokonya rusak, melainkan
   * TD-nya kepotong percuma. Kalimatnya menutup dengan kapan barangnya jadi berguna lagi. */
  pool_empty: {
    message: 'Stok reward lagi habis, jadi energi belum ada gunanya. Saldo kamu aman, coba lagi nanti ya.',
    status: 409,
  },
}

/** `requestId` datang dari klien dan itu memang syaratnya — sama seperti koreksi admin. Belanja
 * tidak punya id alami, jadi yang menandai "pembelian yang sama" cuma satu tap yang sama. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`store:buy:${user.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ key?: unknown; requestId?: unknown }>(request)
    const key = typeof body?.key === 'string' ? body.key : ''
    const requestId = typeof body?.requestId === 'string' ? body.requestId : ''
    if (!UUID.test(requestId)) {
      return apiError('STORE_BUY_REFUSED', 'Pembeliannya nggak kebaca. Coba lagi ya.', 400)
    }

    const bought = await buyStoreItem(user.id, key, requestId)
    if (!bought.ok) {
      const refusal = REFUSAL[bought.reason]
      return apiError('STORE_BUY_REFUSED', refusal.message, refusal.status)
    }

    return Response.json(bought, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
