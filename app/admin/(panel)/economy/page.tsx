import { redirect } from 'next/navigation'
import { readEconomyAudit, readEconomyConfigSnapshot } from '@/server/economy-config'
import { getSessionUser } from '@/server/session'
import { EconomyForm } from './economy-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminEconomyPage() {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  const [snapshot, audit] = await Promise.all([readEconomyConfigSnapshot(), readEconomyAudit()])

  return <EconomyForm snapshot={snapshot} audit={audit} />
}
