export type PrestigeKey = 'founder' | 'milestone' | 'precision' | 'premium'

export interface PrestigeBadge {
  key: PrestigeKey
  label: string
  detail: string
}

export const FOUNDER_MAX_USER_ID = 500

export const TASK_MILESTONES: readonly { tasks: number; label: string }[] = [
  { tasks: 1_000, label: 'Seribu' },
  { tasks: 5_000, label: 'Lima Ribu' },
  { tasks: 10_000, label: 'Sepuluh Ribu' },
]

export const PRECISION_MIN_TASKS = 200
export const PRECISION_MIN_AVERAGE = 6

export function taskMilestone(taskCount: number): { tasks: number; label: string } | null {
  let reached: { tasks: number; label: string } | null = null
  for (const milestone of TASK_MILESTONES) {
    if (taskCount >= milestone.tasks) reached = milestone
  }
  return reached
}

export function averageReward(credits: number, taskCount: number): number {
  if (taskCount <= 0) return 0
  return credits / taskCount
}

export function hasPrecision(credits: number, taskCount: number): boolean {
  return (
    taskCount >= PRECISION_MIN_TASKS &&
    averageReward(credits, taskCount) >= PRECISION_MIN_AVERAGE
  )
}

export interface PrestigeInput {
  taskCount: number
  credits: number
  founder: boolean
  premium: boolean
}

/** Urutannya urutan KELANGKAAN, bukan urutan cerita, karena pemanggil yang sempit ruangnya memotong dari belakang — baris papan peringkat hanya memberi dua slot. Presisi lebih dulu karena ia satu-satunya yang tidak bisa didapat dengan waktu: rata-rata segitu menuntut Sulit bintang tiga berulang kali. Perintis justru paling belakang meski paling langka pada akhirnya — selama pengguna masih di bawah `FOUNDER_MAX_USER_ID`, SEMUA orang memilikinya, dan lencana yang dipunyai semua orang adalah yang paling tidak layak memakai slot terakhir. */
export function prestigeBadges({
  taskCount,
  credits,
  founder,
  premium,
}: PrestigeInput): PrestigeBadge[] {
  const badges: PrestigeBadge[] = []

  if (hasPrecision(credits, taskCount)) {
    badges.push({
      key: 'precision',
      label: 'Presisi',
      detail: `Rata-rata minimal ${PRECISION_MIN_AVERAGE} credit selama ${PRECISION_MIN_TASKS}+ task.`,
    })
  }

  const milestone = taskMilestone(taskCount)
  if (milestone) {
    badges.push({
      key: 'milestone',
      label: milestone.label,
      detail: `Sudah menyelesaikan ${milestone.tasks.toLocaleString('id-ID')} task.`,
    })
  }

  if (premium) {
    badges.push({ key: 'premium', label: 'Premium', detail: 'Anggota premium aktif.' })
  }

  if (founder) {
    badges.push({
      key: 'founder',
      label: 'Perintis',
      detail: `Termasuk ${FOUNDER_MAX_USER_ID} akun pertama Tugas Duit.`,
    })
  }

  return badges
}
