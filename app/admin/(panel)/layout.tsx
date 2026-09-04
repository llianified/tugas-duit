import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth/session'
import { AdminNav } from './admin-nav'
import { SignOutButton } from './sign-out-button'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">TD</span>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-foreground">Tugas Duit</p>
            <p className="text-xs text-muted-foreground">Pusat kendali admin</p>
          </div>
        </div>

        <AdminNav />

        <div className="admin-account">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user.firstName}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <SignOutButton compact />
        </div>
      </aside>

      <header className="admin-mobile-header">
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">TD</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold text-foreground">Panel admin</p>
            <p className="truncate text-xs text-muted-foreground">{user.firstName}</p>
          </div>
        </div>
        <SignOutButton compact />
      </header>

      <main className="admin-main">
        <div className="admin-content">{children}</div>
      </main>
    </div>
  )
}
