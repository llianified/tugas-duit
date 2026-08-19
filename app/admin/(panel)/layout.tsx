import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/session'
import { AdminNav } from './admin-nav'
import { SignOutButton } from './sign-out-button'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">Panel admin</p>
            <p className="truncate text-xs text-muted-foreground">{user.firstName}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="admin-pb mx-auto max-w-md px-4 py-4">{children}</main>

      <AdminNav />
    </>
  )
}
