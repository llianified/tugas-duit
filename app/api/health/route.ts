import { query } from '@/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await query('select 1')
    return Response.json({ ok: true })
  } catch (error) {
    // Jangan pernah menelan error di sini. Monitor hanya menerima status 503,
    // sedangkan log fungsi Vercel menyimpan jejak error lengkap — biasanya
    // DATABASE_URL Neon belum diset, tidak valid, atau koneksinya sedang gagal.
    console.error('[health] cek database gagal:', error)
    const reason = error instanceof Error ? error.message : 'unknown'
    return Response.json({ ok: false, reason }, { status: 503 })
  }
}
