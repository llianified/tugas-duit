import { loadEconomyConfig } from '@/server/economy/economy-config'
import { clientIp, readJsonBody } from '@/server/platform/http'
import { notifyShopOrderPaid } from '@/server/messaging/notify'
import { settleCashOrder } from '@/server/shop/cash-order'
import { webhookStatusIsPaid } from '@/server/premium/premium-payment'
import { checkRateLimit } from '@/server/platform/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ok = () => Response.json({ ok: true })

/** Kembaran `/api/premium/webhook`, sampai ke alasan tiap keputusannya. URL ini publik dan tidak
 * bisa dilindungi origin check maupun sesi — yang membedakan callback asli dari POST karangan cuma
 * `signature`, yang dibandingkan dengan signature yang tersimpan saat tagihannya dibuat. Karena itu
 * balasan 200 diberikan juga untuk pesanan yang tidak dikenal DAN untuk signature yang salah:
 * gateway berhenti mengulang, dan penyerang tidak mendapat jawaban yang membocorkan pesanan mana
 * yang ada. */
export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit(`shop:webhook:${clientIp(request)}`, 120, 60)
    if (!limit.allowed) return ok()

    const body = await readJsonBody<{
      order_id?: unknown
      status?: unknown
      signature?: unknown
      total_amount?: unknown
    }>(request)
    const orderId = typeof body?.order_id === 'string' ? body.order_id.trim() : ''
    if (!orderId) return ok()
    if (!webhookStatusIsPaid(body?.status)) return ok()

    await loadEconomyConfig()
    const signature = typeof body?.signature === 'string' ? body.signature : null
    const paidAmount = Math.round(Number(body?.total_amount))
    const settled = await settleCashOrder(
      orderId,
      signature,
      'webhook',
      Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : null,
    )

    if (!settled.settled) {
      if (settled.reason === 'bad_signature') {
        console.warn('[shop] signature webhook tidak cocok untuk pesanan %s', orderId)
      }
      return ok()
    }

    await notifyShopOrderPaid(settled.telegramId, settled.itemTitle).catch((error) =>
      console.warn('[shop] notifikasi pesanan gagal', error),
    )
    return ok()
  } catch (error) {
    console.error('[shop] webhook gagal diproses:', error)
    return new Response(null, { status: 500 })
  }
}
