import { connection } from 'next/server'
import { AppShell } from '@/shell/app-shell'

export default async function Page() {
  await connection()
  return <AppShell />
}
