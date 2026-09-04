import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth/session'
import { LoginForm } from './login-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const user = await getSessionUser()
  if (user && !user.bannedAt && user.isAdmin) redirect('/admin/dashboard')

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-2">
      <section className="hidden border-r border-border bg-card p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">TD</span>
          <div><p className="font-display text-sm font-bold text-foreground">Tugas Duit</p><p className="text-xs text-muted-foreground">Pusat kendali admin</p></div>
        </div>
        <div className="max-w-lg">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Akses internal</p>
          <h1 className="pt-3 font-display text-4xl font-bold leading-tight text-balance text-foreground">Kelola operasi tanpa kehilangan konteks.</h1>
          <p className="pt-4 text-base leading-relaxed text-pretty text-muted-foreground">Pantau payout, pengguna, ekonomi, dan komunikasi dari satu ruang kerja yang aman.</p>
        </div>
        <p className="text-xs text-muted-foreground">Panel ini tidak ditampilkan kepada peserta.</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="admin-brand mb-8 lg:hidden">
            <span className="admin-brand-mark" aria-hidden="true">TD</span>
            <div><p className="font-display text-sm font-bold text-foreground">Tugas Duit</p><p className="text-xs text-muted-foreground">Pusat kendali admin</p></div>
          </div>
          <div className="admin-panel p-5 sm:p-7">
            <header className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Akses internal</p>
              <h2 className="font-display text-2xl font-bold text-foreground">Masuk ke panel admin</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">Gunakan kata sandi administrator. Peserta tetap masuk melalui Mini App Telegram.</p>
            </header>
            <div className="mt-6"><LoginForm /></div>
          </div>
        </div>
      </section>
    </main>
  )
}
