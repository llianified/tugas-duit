import {
  AdminGrantError,
  GRANT_REASON_MAX,
  grantUserEnergy,
  grantUserPremium,
  refillUserRewardPool,
  resetUserChannelGate,
  revokeUserPremium,
  setUserNotificationsMuted,
} from '@/server/admin/admin-grants'
import {
  AdminUserError,
  BAN_REASON_MAX,
  setUserAdminFlag,
  setUserSuspension,
  updateAdminUserProfile,
} from '@/server/admin/admin-users'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { requireUser } from '@/server/auth/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE: Record<string, string> = {
  REASON_REQUIRED: 'Alasannya wajib diisi.',
  REASON_TOO_LONG: `Alasan maksimum ${BAN_REASON_MAX} karakter (aksi hibah: ${GRANT_REASON_MAX}).`,
  SELF_SUSPENSION_FORBIDDEN:
    'Akun sendiri tidak bisa ditangguhkan — panel ini akan langsung tertutup.',
  SELF_DEMOTION_FORBIDDEN:
    'Hak admin sendiri tidak bisa dicabut dari sini. Cabut dari akun admin lain.',
  INVALID_FIRST_NAME: 'Nama wajib diisi, maksimum 64 karakter.',
  INVALID_USERNAME: 'Username hanya boleh huruf, angka, dan garis bawah.',
  INVALID_AMOUNT: 'Jumlahnya di luar batas yang diterima.',
}

type Body = {
  action?:
    | 'suspend'
    | 'restore'
    | 'grant-admin'
    | 'revoke-admin'
    | 'profile'
    | 'premium-grant'
    | 'premium-revoke'
    | 'energy-grant'
    | 'pool-refill'
    | 'notifications-mute'
    | 'notifications-unmute'
    | 'channel-gate-reset'
  reason?: string
  firstName?: string
  username?: string | null
  days?: number
  amount?: number
  credits?: number
}

export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    /** `energy-grant` dan `pool-refill` menjepit hibahnya di `maxEnergy()` dan `rewardPoolCapacity()`, dan keduanya membaca `economyConfig()` — state global proses yang baru terpasang setelah `loadEconomyConfig()`. Tanpa baris ini, PATCH yang mendarat di instance dingin memakai nilai BAWAAN, bukan yang tersimpan: kompensasi terpotong di angka yang salah dan `admin_actions.detail.kapasitas` ikut mencatat angka yang salah. */
    await loadEconomyConfig()
    const admin = await requireUser()
    if (!admin.isAdmin) return new Response(null, { status: 404 })
    const limit = await checkRateLimit(`admin:user-write:${admin.id}`, 60, 3_600)
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    const { publicId } = await params
    const body = (await request.json().catch(() => null)) as Body | null
    if (!body || typeof body !== 'object') {
      return apiError('VALIDATION_FAILED', 'Body tidak valid.', 400)
    }

    switch (body.action) {
      case 'suspend':
      case 'restore': {
        const result = await setUserSuspension({
          adminId: admin.id,
          publicId,
          suspended: body.action === 'suspend',
          reason: body.reason?.trim() || null,
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'grant-admin':
      case 'revoke-admin': {
        const result = await setUserAdminFlag({
          adminId: admin.id,
          publicId,
          isAdmin: body.action === 'grant-admin',
          reason: body.reason?.trim() || null,
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'profile': {
        const result = await updateAdminUserProfile({
          adminId: admin.id,
          publicId,
          firstName: body.firstName ?? '',
          username: body.username ?? null,
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'premium-grant': {
        const result = await grantUserPremium({
          adminId: admin.id,
          publicId,
          days: body.days ?? 0,
          reason: body.reason ?? '',
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'premium-revoke': {
        const result = await revokeUserPremium({
          adminId: admin.id,
          publicId,
          reason: body.reason ?? '',
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'energy-grant': {
        const result = await grantUserEnergy({
          adminId: admin.id,
          publicId,
          amount: body.amount ?? 0,
          reason: body.reason ?? '',
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'pool-refill': {
        const result = await refillUserRewardPool({
          adminId: admin.id,
          publicId,
          credits: body.credits ?? 0,
          reason: body.reason ?? '',
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'notifications-mute':
      case 'notifications-unmute': {
        const result = await setUserNotificationsMuted({
          adminId: admin.id,
          publicId,
          muted: body.action === 'notifications-mute',
          reason: body.reason ?? '',
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'channel-gate-reset': {
        const result = await resetUserChannelGate({
          adminId: admin.id,
          publicId,
          reason: body.reason ?? '',
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      default:
        return apiError('VALIDATION_FAILED', 'Aksi tidak valid.', 400)
    }
  } catch (error) {
    if (error instanceof AdminGrantError) {
      return apiError(error.code, MESSAGE[error.code] ?? 'Aksi tidak bisa diterapkan.', error.status)
    }
    if (error instanceof AdminUserError) {
      return apiError(error.code, MESSAGE[error.code] ?? 'Perubahan tidak bisa diterapkan.', error.status)
    }
    return handleRouteError(error)
  }
}
