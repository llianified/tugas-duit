import { parseAdPostback } from '@/domain/ads/postback'
import { settleAdPostback } from '@/server/ads/postback'
import { resolveAdProvider } from '@/server/ads/ad-provider'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { apiError, clientIp, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { matchesSecret } from '@/server/platform/secret'
import { env } from '@/server/platform/env'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Monetag mengirim GET dan tidak bisa membawa header, jadi rahasianya terpaksa ikut di query. Konsekuensinya nilai ini ikut tercatat di log akses Vercel — ia rahasia yang bisa dibaca siapa pun yang bisa membaca log, bukan kredensial kelas satu. Yang menahan kerugiannya: rahasia ini tidak membuka data apa pun, hanya bisa mengonfirmasi tiket yang ID-nya sudah harus diketahui lebih dulu, dan menggantinya cukup dengan mengubah env lalu menempel ulang URL-nya di dashboard. */
const SECRET_PARAM = 'k'

/** Volume normalnya kecil (paling banyak dua event per tayangan), jadi plafon ini bukan pengatur tempo Monetag melainkan penahan kalau URL-nya bocor dan dihantam dari luar. */
const POSTBACK_LIMIT_PER_MINUTE = 600

/** Satu-satunya kabar tentang tayangan iklan yang tidak lewat tangan klien. | Jawaban 200 diberikan juga untuk tiket yang tidak dikenal: Monetag mengulang kirim sampai dijawab 200, dan mengulang postback yang memang tidak punya tiket hanya menambah beban tanpa mengubah hasilnya. Yang benar-benar gagal (DB tumbang) dijawab 500 supaya ulangannya berguna. */
export async function GET(request: Request) {
  try {
    const expected = env.monetagPostbackSecretOrNull
    if (!expected) {
      console.error('[ads] MONETAG_POSTBACK_SECRET belum diset — postback ditolak.')
      return apiError('POSTBACK_NOT_CONFIGURED', 'Postback belum dikonfigurasi.', 503)
    }

    const url = new URL(request.url)
    const supplied = url.searchParams.get(SECRET_PARAM) ?? ''
    if (!supplied || !matchesSecret(supplied, expected)) {
      return apiError('UNAUTHORIZED', 'Tidak dikenal.', 401)
    }

    const limit = await checkRateLimit(
      `ads:postback:${clientIp(request)}`,
      POSTBACK_LIMIT_PER_MINUTE,
      60,
    )
    if (!limit.allowed) return rateLimited(limit.retryAfter)

    await loadEconomyConfig()
    const params = parseAdPostback(url.searchParams)

    /** Zone yang tidak cocok tidak ditolak, hanya dicatat: `ymid` sudah harus cocok dengan satu baris `ad_views` sebelum apa pun terjadi, jadi zone bukan pengaman melainkan penanda salah pasang URL — dan menolak karenanya berarti menghanguskan tayangan yang benar-benar dibayar. */
    const zoneId = resolveAdProvider().unitId
    if (params.zoneId && params.zoneId !== zoneId) {
      console.warn(`[ads] postback dari zone ${params.zoneId}, sedangkan app memakai ${zoneId}`)
    }

    const outcome = await settleAdPostback(params)
    return Response.json({ ok: true, outcome }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[ads] postback gagal diproses:', error)
    return new Response(null, { status: 500 })
  }
}
