import { isPreviewDb } from '@/server/platform/db'
import { loadEconomyConfig } from '@/server/economy/economy-config'
import { assertSameOrigin, clientIp, rateLimited } from '@/server/platform/http'
import { checkRateLimit } from '@/server/platform/ratelimit'
import { seedPreview } from '@/server/platform/seed-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Mengisi database preview dengan data yang enak dibaca. Bentuknya route, bukan skrip `pnpm`, karena database preview adalah PGlite yang `dataDir`-nya dipegang proses server dev — proses kedua yang membukanya berhenti di lock filenya, bukan di pesan yang menjelaskan kenapa. 404 di luar preview, sama seperti `/api/dev/login`: yang menjaganya bukan kesopanan pemanggil melainkan `isPreviewDb()`, jadi route ini tidak punya bentuk apa pun di deploy sungguhan. Bahkan kalau ada yang memanggilnya di sana, `seedPreview` akan menghapus user dan menulis saldo — kerusakan yang tidak bisa diperbaiki dengan mengembalikan 403. */
export async function POST(request: Request) {
  if (!isPreviewDb()) {
    return new Response(null, { status: 404 })
  }
  const origin = assertSameOrigin(request)
  if (origin) return origin
  try {
    const limit = await checkRateLimit(`dev-seed:${clientIp(request)}`, 10, 60)
    if (!limit.allowed) return rateLimited(limit.retryAfter)
    await loadEconomyConfig()
    const result = await seedPreview()
    return Response.json({ ok: true, ...result })
  } catch (error) {
    /** Pesan aslinya dikembalikan, bukan disembunyikan `handleRouteError`. Route ini hanya ada di preview dan satu-satunya pemanggilnya adalah orang yang sedang mengisi data: "Ada yang error, coba lagi ya" pada seed yang gagal karena satu constraint berarti harus mengorek log server untuk tahu constraint yang mana. */
    console.error('[seed] gagal:', error)
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
