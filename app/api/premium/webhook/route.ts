import { loadEconomyConfig } from '@/server/economy/economy-config'
import { clientIp, readJsonBody } from '@/server/platform/http'
import { notifyPremiumActivated } from '@/server/messaging/notify'
import { settlePremiumPayment, webhookStatusIsPaid } from '@/server/premium/premium-payment'
import { checkRateLimit } from '@/server/platform/ratelimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ok = () => Response.json({ ok: true })

/** URL ini publik dan tidak bisa dilindungi origin check maupun sesi — yang membedakan callback asli dari POST karangan hanya `signature`, yang dibandingkan dengan signature yang tersimpan saat tagihannya dibuat. Karena itu balasan 200 diberikan juga untuk order yang tidak dikenal: gateway berhenti mengulang, dan penyerang tidak mendapat jawaban yang membocorkan order mana yang ada. */
export async function POST(request: Request) {
  try {
    const limit = await checkRateLimit(`premium:webhook:${clientIp(request)}`, 120, 60)
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
    const settled = await settlePremiumPayment(
      orderId,
      signature,
      'webhook',
      Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : null,
    )

    if (!settled.settled) {
      if (settled.reason === 'bad_signature') return new Response(null, { status: 401 })
      return ok()
    }

    await notifyPremiumActivated(settled.telegramId, settled.months, settled.premiumUntil).catch(
      (error) => console.warn('[premium] notifikasi aktivasi gagal', error),
    )
    return ok()
  } catch (error) {
    console.error('[premium] webhook gagal diproses:', error)
    return new Response(null, { status: 500 })
  }
}
