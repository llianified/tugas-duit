import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth/session'
import { countPendingPayouts } from '@/server/payout/payout'
import { AdminNav } from './admin-nav'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  const pendingPayouts = await countPendingPayouts()

  return (
    <div className="admin-shell">
      <main className="admin-content">{children}</main>
      <AdminNav pendingPayouts={pendingPayouts} />
    </div>
  )
}
