export type AppView =
  | 'home'
  | 'captcha'
  | 'history'
  | 'referral'
  | 'stats'
  | 'leaderboard'
  | 'profile'

export const ROOT_VIEW: AppView = 'home'

export const VIEW_TITLE: Record<Exclude<AppView, 'home'>, string> = {
  captcha: 'Kerjakan task',
  history: 'Riwayat',
  referral: 'Undang teman',
  stats: 'Statistik',
  leaderboard: 'Peringkat',
  profile: 'Profil',
}
