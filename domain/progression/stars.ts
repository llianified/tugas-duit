
import type { Difficulty } from '@/domain/task/challenge'
import { economyConfig, parTimeMs, starReward } from '../economy/economy-config'

export type StarCount = 1 | 2 | 3

export const STAR_MAX = 3

export function getStars(elapsedMs: number, difficulty: Difficulty, parScale = 1): StarCount {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 3
  const cutoff = getStarCutoffs(difficulty, parScale)
  if (elapsedMs <= cutoff[3]) return 3
  if (elapsedMs <= cutoff[2]) return 2
  return 1
}

/** `parScale` datang dari varian soal, bukan dari panel: par time yang disetel admin berlaku untuk
 * bentuk aslinya, dan varian yang lebih lambat dikerjakan mendapat jendela yang sebanding. Tanpa
 * ini, menambah varian akan menurunkan laju bintang — dan dengan begitu reward — tanpa satu pun
 * angka ekonomi berubah. Bawaannya 1 supaya soal lama dan pemanggil lama tidak bergeser. */
export function getStarCutoffs(
  difficulty: Difficulty,
  parScale = 1,
): Record<Exclude<StarCount, 1>, number> {
  const par = parTimeMs(difficulty) * (Number.isFinite(parScale) && parScale > 0 ? parScale : 1)
  return { 3: par, 2: par * economyConfig().star2ParMultiplier }
}

interface LiveStarState {
  stars: StarCount
  reward: number
  remainingRatio: number
}

export function getLiveStarState(
  elapsedMs: number,
  difficulty: Difficulty,
  parScale = 1,
): LiveStarState {
  const stars = getStars(elapsedMs, difficulty, parScale)
  const reward = getStarReward(difficulty, stars)
  const cutoff = getStarCutoffs(difficulty, parScale)

  const finalDeadline = cutoff[2]
  const remainingMs = Math.max(0, finalDeadline - Math.max(elapsedMs, 0))

  return { stars, reward, remainingRatio: remainingMs / finalDeadline }
}

export function getStarReward(difficulty: Difficulty, stars: StarCount): number {
  return starReward(difficulty, stars)
}

export function getMaxReward(difficulty: Difficulty): number {
  return getStarReward(difficulty, 3)
}
