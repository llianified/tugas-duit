import {
  AdminUserError,
  BAN_REASON_MAX,
  setUserAdminFlag,
  setUserSuspension,
  updateAdminUserProfile,
} from '@/server/admin-users'
import { apiError, assertSameOrigin, handleRouteError, rateLimited } from '@/server/http'
import { checkRateLimit } from '@/server/ratelimit'
import { requireUser } from '@/server/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MESSAGE: Record<string, string> = {
  REASON_REQUIRED: 'Alasan penangguhan wajib diisi.',
  REASON_TOO_LONG: `Alasan maksimum ${BAN_REASON_MAX} karakter.`,
  SELF_SUSPENSION_FORBIDDEN:
    'Akun sendiri tidak bisa ditangguhkan — panel ini akan langsung tertutup.',
  SELF_DEMOTION_FORBIDDEN:
    'Hak admin sendiri tidak bisa dicabut dari sini. Cabut dari akun admin lain.',
  INVALID_FIRST_NAME: 'Nama wajib diisi, maksimum 64 karakter.',
  INVALID_USERNAME: 'Username hanya boleh huruf, angka, dan garis bawah.',
}

type Body = {
  action?: 'suspend' | 'restore' | 'grant-admin' | 'revoke-admin' | 'profile'
  reason?: string
  firstName?: string
  username?: string | null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
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
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      case 'profile': {
        const result = await updateAdminUserProfile({
          publicId,
          firstName: body.firstName ?? '',
          username: body.username ?? null,
        })
        if (!result) return new Response(null, { status: 404 })
        return Response.json(result)
      }
      default:
        return apiError('VALIDATION_FAILED', 'Aksi tidak valid.', 400)
    }
  } catch (error) {
    if (error instanceof AdminUserError) {
      return apiError(error.code, MESSAGE[error.code] ?? 'Perubahan tidak bisa diterapkan.', error.status)
    }
    return handleRouteError(error)
  }
}
