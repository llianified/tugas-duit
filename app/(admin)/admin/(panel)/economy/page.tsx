import { redirect } from 'next/navigation'
import { readEconomyAudit, readEconomyConfigSnapshot } from '@/server/economy/economy-config'
import { readActiveUserBaseline } from '@/server/admin/admin-stats'
import { getSessionUser } from '@/server/auth/session'
import { EconomyForm } from './economy-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminEconomyPage() {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  const [snapshot, audit, activeUsers] = await Promise.all([
    readEconomyConfigSnapshot(),
    readEconomyAudit(),
    readActiveUserBaseline(),
  ])

  return <EconomyForm snapshot={snapshot} audit={audit} activeUsers={activeUsers} />
}
