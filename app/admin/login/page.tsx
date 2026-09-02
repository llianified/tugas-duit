import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/auth/session'
import { LoginForm } from './login-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const user = await getSessionUser()
  if (user && !user.bannedAt && user.isAdmin) redirect('/admin/withdrawals')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold text-foreground">Masuk panel payout</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Halaman ini untuk meninjau pengajuan penarikan. Bukan tempat masuk untuk peserta —
          aplikasinya dibuka dari Telegram.
        </p>
      </div>
      <LoginForm />
    </main>
  )
}
