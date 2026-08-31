import { creditsToRupiah, rupiahToCredits, withdrawalMinimumCredits } from './economy.ts'
import type { EconomyConfig } from './economy-config.ts'
import {
  baseRewardPoolCredits,
  rewardPoolCapacity,
  rewardPoolCreditsPerDay,
} from './reward-pool.ts'

/**
 * Plafon penghasilan user untuk satu objek config yang dioper — bukan config aktif.
 *
 * Panel admin memakai ini untuk memperlihatkan akibat setelan yang BELUM disimpan, jadi
 * ia harus bisa menghitung config mana pun termasuk draf yang sedang diketik. Karena itu
 * setiap rumus di sini memanggil fungsi domain yang sudah ada dengan config eksplisit
 * (`creditsToRupiah`, `withdrawalMinimumCredits`, `rewardPoolCreditsPerDay`,
 * `rewardPoolCapacity`) alih-alih menghitung ulang sendiri — tidak ada aritmetika
 * credit→Rupiah kedua di repo ini.
 */

export type BindingLimit = 'kolam' | 'energi' | 'batas-task'

export interface EarningsProjection {
  /** Credit yang bisa dipanen dari task sendiri dalam 24 jam, plafon sebenarnya. */
  taskCreditsPerDay: number
  taskRupiahPerDay: number
  taskRupiahPerWeek: number
  taskRupiahPerMonth: number

  /** Plafon komisi referral harian. Berdiri sendiri, tidak lewat kolam reward. */
  commissionCreditsPerDay: number
  commissionRupiahPerDay: number
  commissionRupiahPerMonth: number

  totalRupiahPerDay: number
  totalRupiahPerMonth: number

  /** Kapasitas kolam: berapa yang bisa ditumpuk, bukan berapa cepat terisi. */
  poolCapacityBase: number
  poolCapacityMax: number
  poolFullHours: number

  /** Task yang sanggup dikerjakan sehari — dipakai menentukan apa yang jadi pengikat. */
  tasksFromEnergy: number
  tasksFromAds: number
  taskCapPerDay: number
  /** Credit maksimum kalau setiap task yang mungkin dikerjakan berbuah reward tertinggi. */
  taskCeilingCredits: number

  /**
   * Setelan mana yang benar-benar menahan penghasilan. Selama 'kolam', menaikkan batas
   * task atau energi tidak mengubah apa pun.
   */
  binding: BindingLimit

  withdrawalMinimumCredits: number
  daysToWithdrawalBalance: number
}

const MINUTES_PER_DAY = 1_440
const DAYS_PER_WEEK = 7
const DAYS_PER_MONTH = 30

const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

export function projectEarnings(config: EconomyConfig): EarningsProjection {
  const safe: EconomyConfig = {
    ...config,
    creditValueIdr: positive(config.creditValueIdr) || 1,
    rewardPoolRegenMinutes: positive(config.rewardPoolRegenMinutes) || 1,
    rewardPoolRegenCredits: positive(config.rewardPoolRegenCredits),
    rewardPoolCapIdr: positive(config.rewardPoolCapIdr),
    rankPoolCapBonus: positive(config.rankPoolCapBonus),
    maxStreakCapBonus: positive(config.maxStreakCapBonus),
    premiumPoolCapBonus: positive(config.premiumPoolCapBonus),
    streakCapStepDays: positive(config.streakCapStepDays) || 1,
    withdrawalMinimumIdr: positive(config.withdrawalMinimumIdr),
    dailyCommissionCapIdr: positive(config.dailyCommissionCapIdr),
  }
  const regenMinutes = safe.rewardPoolRegenMinutes
  const regenCredits = safe.rewardPoolRegenCredits

  const taskCreditsPerDay = rewardPoolCreditsPerDay(safe)
  const commissionCreditsPerDay = rupiahToCredits(safe.dailyCommissionCapIdr, safe)

  const poolCapacityBase = baseRewardPoolCredits(safe)
  const poolCapacityMax = rewardPoolCapacity(
    { rankTier: 5, streak: safe.streakCapStepDays * safe.maxStreakCapBonus, premium: true },
    safe,
  )

  const energyRegenMinutes = positive(config.energyRegenMinutes) || 1
  const energyCost = positive(config.energyCostPerTask) || 1
  const energyPerDay =
    positive(config.maxEnergy) + Math.floor(MINUTES_PER_DAY / energyRegenMinutes)
  const tasksFromEnergy = Math.floor(energyPerDay / energyCost)
  const tasksFromAds = positive(config.adsMaxViewsPerDay)
  const taskCapPerDay = Math.min(
    positive(config.maxTasksPerDay),
    tasksFromEnergy + tasksFromAds,
  )

  const bestReward = Math.max(
    positive(config.rewardEasy3),
    positive(config.rewardMedium3),
    positive(config.rewardHard3),
  )
  const taskCeilingCredits = taskCapPerDay * bestReward

  const binding: BindingLimit =
    taskCeilingCredits >= taskCreditsPerDay
      ? 'kolam'
      : positive(config.maxTasksPerDay) <= tasksFromEnergy + tasksFromAds
        ? 'batas-task'
        : 'energi'

  const harvestable = Math.min(taskCreditsPerDay, taskCeilingCredits)
  const withdrawalMinimum = withdrawalMinimumCredits(safe)
  const perDayTowardsWithdrawal = harvestable + commissionCreditsPerDay
  const rupiah = (credits: number) => creditsToRupiah(credits, safe)

  return {
    taskCreditsPerDay: harvestable,
    taskRupiahPerDay: rupiah(harvestable),
    taskRupiahPerWeek: rupiah(harvestable * DAYS_PER_WEEK),
    taskRupiahPerMonth: rupiah(harvestable * DAYS_PER_MONTH),

    commissionCreditsPerDay,
    commissionRupiahPerDay: rupiah(commissionCreditsPerDay),
    commissionRupiahPerMonth: rupiah(commissionCreditsPerDay * DAYS_PER_MONTH),

    totalRupiahPerDay: rupiah(harvestable + commissionCreditsPerDay),
    totalRupiahPerMonth: rupiah((harvestable + commissionCreditsPerDay) * DAYS_PER_MONTH),

    poolCapacityBase,
    poolCapacityMax,
    poolFullHours: regenCredits === 0 ? 0 : (poolCapacityBase / regenCredits) * (regenMinutes / 60),

    tasksFromEnergy,
    tasksFromAds,
    taskCapPerDay,
    taskCeilingCredits,
    binding,

    withdrawalMinimumCredits: withdrawalMinimum,
    daysToWithdrawalBalance:
      perDayTowardsWithdrawal === 0 ? 0 : Math.ceil(withdrawalMinimum / perDayTowardsWithdrawal),
  }
}

export const BINDING_LABEL: Record<BindingLimit, string> = {
  kolam: 'Kolam reward',
  energi: 'Energi dan iklan',
  'batas-task': 'Batas task harian',
}

export const BINDING_NOTE: Record<BindingLimit, string> = {
  kolam:
    'Penghasilan dibatasi laju isi ulang kolam. Menaikkan batas task, energi, atau reward per bintang tidak menambah penghasilan siapa pun selama ini yang mengikat.',
  energi:
    'Energi dan jatah iklan habis sebelum kolam kosong, jadi user tidak bisa memanen seluruh isi kolamnya. Kolam yang lebih besar terbuang.',
  'batas-task':
    'Batas task harian tercapai sebelum kolam kosong, jadi user tidak bisa memanen seluruh isi kolamnya. Kolam yang lebih besar terbuang.',
}
