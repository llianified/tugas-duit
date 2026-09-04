import { redirect } from 'next/navigation'
import { readEconomyConfigSnapshot } from '@/server/economy/economy-config'
import { getSessionUser } from '@/server/auth/session'
import { EconomyForm } from './economy-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminEconomyPage() {
  const user = await getSessionUser()
  if (!user || user.bannedAt || !user.isAdmin) redirect('/admin/login')

  const snapshot = await readEconomyConfigSnapshot()

  return <EconomyForm snapshot={snapshot} />
}
