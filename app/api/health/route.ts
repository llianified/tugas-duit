import { query } from '@/server/platform/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await query('select 1')
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Jangan pernah menelan error di sini. Monitor hanya menerima status 503, | sedangkan log fungsi Vercel menyimpan jejak error lengkap — biasanya | DATABASE_URL Neon belum diset, tidak valid, atau koneksinya sedang gagal.
    console.error('[health] cek database gagal:', error)
    /** Sebabnya tinggal di log, tidak ikut di badan jawaban. Route ini publik dan tanpa sesi, sedangkan pesan error `pg` memuat host, nama database, dan nama user Neon apa adanya (`getaddrinfo ENOTFOUND ep-…`, `password authentication failed for user "…"`). Monitor cuma perlu status-nya; yang butuh sebabnya punya akses ke log fungsi. */
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
