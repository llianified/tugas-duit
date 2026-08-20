import { query } from '@/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await query('select 1')
    return Response.json({ ok: true })
  } catch (error) {
    // Jangan pernah menelan error di sini. Railway hanya melaporkan "healthcheck
    // failure" tanpa sebab, jadi satu-satunya jejak penyebabnya adalah log ini —
    // biasanya DATABASE_URL belum diset, atau sertifikat Postgres tidak lolos
    // verifikasi karena memakai host publik alih-alih *.railway.internal
    // (DATABASE_SSL_NO_VERIFY sengaja diabaikan di produksi, lihat server/db.ts).
    console.error('[health] cek database gagal:', error)
    const reason = error instanceof Error ? error.message : 'unknown'
    return Response.json({ ok: false, reason }, { status: 503 })
  }
}
