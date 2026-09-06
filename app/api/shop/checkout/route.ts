import type { StorePurchaseRefusal } from '@/domain/store/store'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited, readJsonBody } from '@/server/platform/http'
import { KlikqrisError } from '@/server/integrations/klikqris'
import { CashOrderError, startCashCheckout } from '@/server/shop/cash-order'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Pesan penolakan dipisah dari yang di `/api/store/buy` karena separuhnya memang beda: yang di
 * sana menyebut saldo TD, yang di sini uang. Yang sama persis tetap ditulis sama supaya user yang
 * mencoba dua cara bayar tidak membaca dua penjelasan berbeda untuk keadaan yang satu. */
const REFUSAL: Record<StorePurchaseRefusal, { message: string; status: number }> = {
  store_disabled: { message: 'Tokonya lagi tutup.', status: 409 },
  unknown_item: { message: 'Barangnya nggak ketemu. Muat ulang dulu ya.', status: 400 },
  payment_unavailable: {
    message: 'Barang ini nggak bisa dibayar pakai QRIS. Tebus pakai TD aja ya.',
    status: 409,
  },
  insufficient_balance: { message: 'Saldo TD kamu belum cukup buat beli ini.', status: 409 },
  energy_full: { message: 'Energi kamu bakal kelebihan. Pakai dulu, terus beli lagi.', status: 409 },
  pool_empty: {
    message: 'Stok reward lagi habis, jadi energi belum ada gunanya. Duit kamu aman, coba lagi nanti ya.',
    status: 409,
  },
  already_owned: { message: 'Barang ini udah kamu punya. Tinggal dipakai aja.', status: 409 },
  no_cooldown: {
    message: 'Penarikan kamu lagi nggak kena jeda, jadi nggak ada yang perlu dilewati.',
    status: 409,
  },
  withdrawal_processing: {
    message: 'Pengajuan kamu masih diproses. Tunggu hasilnya dulu, baru beli ini.',
    status: 409,
  },
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await loadEconomyConfig()
    const user = await requireUser()
    const limit = await checkRateLimit(`shop:checkout:${user.id}`, 10, 600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const body = await readJsonBody<{ key?: unknown }>(request)
    const key = typeof body?.key === 'string' ? body.key : ''

    const result = await startCashCheckout(user.id, key)
    if (!result.ok) {
      const refusal = REFUSAL[result.reason]
      return apiError('SHOP_CHECKOUT_REFUSED', refusal.message, refusal.status)
    }
    if (result.settled) {
      return Response.json(
        { settled: true, itemKey: result.itemKey },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return Response.json(
      { settled: false, order: result.order },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    if (error instanceof CashOrderError) {
      return apiError(
        error.code,
        error.code === 'PAYMENT_DISABLED'
          ? 'Pembayaran lagi tidak tersedia. Coba nanti.'
          : 'Pembayaran belum bisa diproses. Coba lagi nanti.',
        error.status,
      )
    }
    if (error instanceof KlikqrisError) {
      console.error('[shop] gateway gagal (%s): %s', error.code, error.message)
      return apiError('PAYMENT_GATEWAY_ERROR', 'QR-nya gagal dibuat. Coba lagi sebentar lagi ya.', 502)
    }
    return handleRouteError(error)
  }
}
