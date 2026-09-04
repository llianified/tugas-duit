export type AppView =
  | 'home'
  | 'captcha'
  | 'missions'
  | 'arcade'
  | 'history'
  | 'referral'
  | 'stats'
  | 'leaderboard'
  | 'profile'

export const ROOT_VIEW: AppView = 'home'

export const VIEW_TITLE: Record<Exclude<AppView, 'home'>, string> = {
  captcha: 'Kerjain soal',
  missions: 'Misi harian',
  arcade: 'Arena',
  history: 'Riwayat',
  referral: 'Undang teman',
  stats: 'Statistik',
  leaderboard: 'Peringkat',
  profile: 'Profil',
}
