import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth/session'
import { LoginForm } from './login-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const user = await getSessionUser()
  if (user && !user.bannedAt && user.isAdmin) redirect('/admin/dashboard')

  return (
    <main className="admin-auth">
      <div className="admin-auth-col">
        <div className="flex items-center gap-2.5">
          <span className="admin-mark" aria-hidden="true">
            TD
          </span>
          <div className="min-w-0">
            <p className="admin-row-title">Tugas Duit</p>
            <p className="admin-sub">Panel admin · akses internal</p>
          </div>
        </div>

        <section className="admin-card">
          <div>
            <h1 className="admin-auth-title">Masuk ke panel</h1>
            <p className="admin-sub">Gunakan kata sandi administrator. Peserta tetap masuk lewat Mini App Telegram.</p>
          </div>
          <LoginForm />
        </section>

        <p className="admin-sub text-center">Panel ini tidak pernah ditampilkan kepada peserta.</p>
      </div>
    </main>
  )
}
