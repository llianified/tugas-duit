
import { getMaxReward, type StarCount } from '@/domain/stars'
import { mathCeiling, mathDigits, selectOptionCount, textLength } from '@/domain/economy-config'

type CaptchaType = 'text' | 'math' | 'select'

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

export type ShapeKey =
  | 'circle'
  | 'square'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'diamond'
  | 'hexagon'
  | 'pentagon'
  | 'cross'

export interface SelectOption {
  key: ShapeKey
  label: string
}

interface ChallengeBase {
  id: string
  title: string
  difficulty: Difficulty
  maxReward: number
  instruction: string
  issuedAt: number
  startedAt: number | null
  expiresAt: number
}

export type Challenge = ChallengeBase &
  (
    | {
        type: 'text'
        display: string
      }
    | {
        type: 'math'
        expression: string
        answerLength: number
      }
    | {
        type: 'select'
        options: SelectOption[]
      }
  )

type GeneratedByFactory = 'id' | 'title' | 'difficulty' | 'maxReward' | 'type'

export type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

type GeneratedChallenge = DistributiveOmit<Challenge, 'issuedAt' | 'startedAt' | 'expiresAt'> & {
  answer: string
}

type DraftFor<T extends CaptchaType> = DistributiveOmit<
  Extract<GeneratedChallenge, { type: T }>,
  GeneratedByFactory
>

export interface HistoryEntry {
  id: string
  title: string
  difficulty: Difficulty
  reward: number
  stars: StarCount
  completedAt: number
}

export interface TaskOutcome {
  challenge: Challenge
  elapsedMs: number
  stars: StarCount
  reward: number
}

interface FailedTaskAttempt {
  attemptsLeft: number
}

export type TaskSubmission = TaskOutcome | FailedTaskAttempt

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  Easy: 'Mudah',
  Medium: 'Sedang',
  Hard: 'Sulit',
}

export const CHALLENGE_TITLE: Record<CaptchaType, string> = {
  text: 'Ketik Ulang Karakter',
  math: 'Hitung Hasil',
  select: 'Pilih Bentuk',
}

const CAPTCHA_TYPES: CaptchaType[] = ['text', 'math', 'select']

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']

export const TEXT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const SELECT_ITEMS: { label: string; key: ShapeKey }[] = [
  { label: 'Lingkaran', key: 'circle' },
  { label: 'Kotak', key: 'square' },
  { label: 'Segitiga', key: 'triangle' },
  { label: 'Bintang', key: 'star' },
  { label: 'Hati', key: 'heart' },
  { label: 'Wajik', key: 'diamond' },
  { label: 'Segi enam', key: 'hexagon' },
  { label: 'Segi lima', key: 'pentagon' },
  { label: 'Palang', key: 'cross' },
]

function randomInt(max: number): number {
  return Math.floor(Math.random() * max)
}

function randomBetween(min: number, max: number): number {
  if (max <= min) return min
  return min + randomInt(max - min + 1)
}

function pickOne<T>(items: readonly T[]): T {
  return items[randomInt(items.length)]
}

function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = randomInt(index + 1)
    ;[result[index], result[swapWith]] = [result[swapWith], result[index]]
  }
  return result
}

function createTextChallenge(difficulty: Difficulty): DraftFor<'text'> {
  const length = textLength(difficulty)
  let value = ''
  for (let i = 0; i < length; i++) value += TEXT_CHARS[randomInt(TEXT_CHARS.length)]

  return {
    instruction: 'Ketik ulang karakter di bawah ini.',
    display: value,
    answer: value.toUpperCase(),
  }
}

function createMathChallenge(difficulty: Difficulty): DraftFor<'math'> {
  const digits = mathDigits(difficulty)
  const minResult = 10 ** (digits - 1)
  const maxResult = Math.min(10 ** digits - 1, mathCeiling(difficulty))

  const operator = pickOne(difficulty === 'Hard' ? ['+', '-', '×'] : ['+', '-'])

  if (operator === '×') {
    const [x, y] = pickFactorPair(minResult, maxResult)
    return {
      instruction: 'Hitung dan masukkan hasilnya.',
      expression: `${x} × ${y}`,
      answer: String(x * y),
      answerLength: digits,
    }
  }

  if (operator === '+') {
    const result = randomBetween(minResult, maxResult)
    const a = randomBetween(1, result - 1)
    return {
      instruction: 'Hitung dan masukkan hasilnya.',
      expression: `${a} + ${result - a}`,
      answer: String(result),
      answerLength: digits,
    }
  }

  const result = randomBetween(minResult, Math.max(minResult, maxResult - 1))
  const low = randomBetween(1, maxResult - result)
  return {
    instruction: 'Hitung dan masukkan hasilnya.',
    expression: `${result + low} - ${low}`,
    answer: String(result),
    answerLength: digits,
  }
}

function pickFactorPair(min: number, max: number): [number, number] {
  const pairs: [number, number][] = []
  for (let x = 2; x <= 12; x += 1) {
    for (let y = 2; y <= 12; y += 1) {
      const product = x * y
      if (product >= min && product <= max) pairs.push([x, y])
    }
  }
  if (pairs.length === 0) return [2, Math.max(2, Math.ceil(min / 2))]
  return pairs[randomInt(pairs.length)]
}

function createSelectChallenge(difficulty: Difficulty): DraftFor<'select'> {
  const pool = shuffle(SELECT_ITEMS).slice(0, selectOptionCount(difficulty))
  const target = pickOne(pool)

  return {
    instruction: `Pilih objek berbentuk ${target.label.toLowerCase()}.`,
    options: pool.map((item) => ({ key: item.key, label: item.label })),
    answer: target.key,
  }
}

let counter = 0
function createChallengeId() {
  counter += 1
  return `ch_${Date.now().toString(36)}_${counter}`
}

function createChallengeMeta(type: CaptchaType, difficulty: Difficulty) {
  return {
    id: createChallengeId(),
    title: CHALLENGE_TITLE[type],
    difficulty,
    maxReward: getMaxReward(difficulty),
  }
}

export function generateChallenge(opts?: {
  type?: CaptchaType
  difficulty?: Difficulty
}): GeneratedChallenge {
  const type = opts?.type ?? pickOne(CAPTCHA_TYPES)
  const difficulty = opts?.difficulty ?? pickOne(DIFFICULTIES)
  const meta = createChallengeMeta(type, difficulty)

  switch (type) {
    case 'text':
      return { ...meta, type, ...createTextChallenge(difficulty) }
    case 'math':
      return { ...meta, type, ...createMathChallenge(difficulty) }
    case 'select':
      return { ...meta, type, ...createSelectChallenge(difficulty) }
  }
}

