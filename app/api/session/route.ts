import { channelBonusEnabled, channelJoinBonusCredits } from '@/domain/economy/economy'
import { economyConfig } from '@/domain/economy/economy-config'
import { isPremiumActive, premiumDaysLeft, premiumPerks, premiumPlans } from '@/domain/economy/premium'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { readAdsState } from '@/server/ads/ads'
import { FOUNDER_MAX_USER_ID } from '@/domain/progression/prestige'
import { readChannelGateState } from '@/server/integrations/channel'
import { isPreviewShell, query } from '@/server/platform/db'
import { readEnergy } from '@/server/economy/energy'
import { env } from '@/server/platform/env'
import { klikqrisConfigured } from '@/server/integrations/klikqris'
import { readPendingInvoice } from '@/server/premium/premium-payment'
import { assertSameOrigin, clientIp, handleRouteError, rateLimited } from '@/server/platform/http'
import { readRewardPool } from '@/server/economy/reward-pool'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { destroySession, getSessionUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BREAKDOWN_SQL = `select coalesce(sum(amount) filter(where kind='task'),0) task_credits,
       coalesce(sum(amount) filter(where kind='commission'),0) referral_credits,
       (select coalesce(sum(credits),0) from withdrawals where user_id=$1 and state='paid') withdrawn_credits
  from credit_ledger where user_id=$1`

export async function GET(request: Request) {
  try {
    await loadEconomyConfig()
    const user = await getSessionUser()
    const limit = user
      ? await checkRateLimit(`session:${user.id}`, 100, 3_600)
      : await checkRateLimit(`session:ip:${clientIp(request)}`, 100, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    if (!user) {
      const bot = env.botUsernameOrNull
      return Response.json(
        {
          user: null,
          economy: economyConfig(),
          botAppUrl: bot ? `https://t.me/${bot}/app` : null,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const [breakdown, energy, rewardPool, ads, invoice, channelGate] = await Promise.all([
      query<{
        task_credits: string
        referral_credits: string
        withdrawn_credits: string
      }>(BREAKDOWN_SQL, [user.id]),
      readEnergy(user.id),
      readRewardPool(user.id),
      readAdsState(user.id),
      readPendingInvoice(user.id),
      readChannelGateState(user),
    ])

    const premiumUntil = user.premiumUntil ? user.premiumUntil.getTime() : null
    const now = Date.now()

    return Response.json(
      {
        user: {
          id: user.publicId,
          firstName: user.firstName,
          username: user.username,
          photoUrl: user.photoUrl,
          balance: user.balanceCredits,
          referralCode: user.referralCode,
          banned: Boolean(user.bannedAt),
          founder: user.id <= FOUNDER_MAX_USER_ID,
        },
        economy: economyConfig(),
        breakdown: {
          taskCredits: Number(breakdown[0].task_credits),
          referralCredits: Number(breakdown[0].referral_credits),
          withdrawnCredits: Number(breakdown[0].withdrawn_credits),
        },
        energy,
        rewardPool,
        ads,
        premium: {
          active: isPremiumActive(premiumUntil, now),
          until: premiumUntil,
          daysLeft: premiumDaysLeft(premiumUntil, now),
          /** Di preview, gerbang ini dibuka tanpa gateway. `paymentEnabled` adalah satu-satunya hal yang menentukan kartu premium dirender atau tidak (`PremiumCard` mengembalikan null tanpanya), dan preview tidak punya KLIKQRIS_API_KEY — jadi seluruh permukaan premium tidak pernah muncul di sana, termasuk untuk dilihat. Yang menjaga uangnya bukan flag ini melainkan `startPremiumCheckout`, yang tetap membaca `klikqrisConfigured()` sendiri dan menjawab PAYMENT_DISABLED: di preview kartunya bisa dibuka dan dibaca, tapi checkout-nya berhenti dengan pesan yang sopan. */
          paymentEnabled: klikqrisConfigured() || isPreviewShell(),
          plans: premiumPlans(),
          perks: premiumPerks(),
          invoice,
        },
        channelBonus: {
          enabled: channelBonusEnabled(),
          url: env.telegramChannelUrl,
          credits: channelJoinBonusCredits(),
          claimed: Boolean(user.channelBonusClaimedAt),
        },
        channelGate,
      },
      /** Muatan paling pribadi di seluruh API — saldo, kode referral, `publicId`, dan tagihan premium yang sedang berjalan — dan satu-satunya baca bersesi yang sempat tidak menyatakan ini. Setiap saudaranya (`/api/stats`, `/api/history`, `/api/withdrawals`, `/api/task`, …) sudah menyetelnya eksplisit; `dynamic = 'force-dynamic'` mengatur rendering, bukan header cache di hilir. */
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function DELETE(request: Request) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    await destroySession()
    return new Response(null, { status: 204 })
  } catch (error) {
    return handleRouteError(error)
  }
}
