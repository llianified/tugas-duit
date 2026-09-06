
import { getMaxReward, type StarCount } from '@/domain/progression/stars'
import { mathCeiling, mathDigits, selectOptionCount, textLength } from '@/domain/economy/economy-config'
import { CAPTCHA_TYPES, type CaptchaType } from './captcha-types'

/** Aturan main di dalam satu tipe soal. Ditambahkan karena isinya yang habis, bukan ekonominya:
 * tiga tipe kali tiga kesulitan cuma sembilan bentuk, dan user yang bertahan sampai hari ke-14
 * sudah mengerjakan seratusan task — tiap bentuk belasan kali. Varian menumpang tipe yang sudah
 * ada supaya `captcha_type` di database tidak perlu ikut berubah untuk menambah isi. */
export type TextVariant = 'copy' | 'reverse' | 'letters'
export type MathVariant = 'result' | 'missing'
export type SelectVariant = 'shape' | 'duplicate' | 'odd'
export type OrderVariant = 'ascending' | 'descending'
export type CountVariant = 'shape'
export type ChallengeVariant =
  | TextVariant
  | MathVariant
  | SelectVariant
  | OrderVariant
  | CountVariant

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
  variant: ChallengeVariant
  /** Pengali par time varian ini. Varian yang lebih lambat dikerjakan mendapat jendela bintang
   * yang lebih panjang, supaya menambah isi tidak diam-diam menurunkan laju bintang — dan dengan
   * begitu reward — untuk pekerjaan yang sama beratnya. Satu berarti secepat varian aslinya. */
  parScale: number
  issuedAt: number
  startedAt: number | null
  expiresAt: number
}

export type Challenge = ChallengeBase &
  (
    | {
        type: 'text'
        display: string
        /** Panjang jawaban, yang tidak selalu sama dengan panjang `display`: varian `letters`
         * membuang angkanya. Dikirim eksplisit supaya jumlah kotak jawaban tidak perlu ditebak
         * dari tampilannya. */
        answerLength: number
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
    | {
        /** Ketuk berurutan. Bentuk interaksi yang benar-benar baru: jawabannya urutan ketukan,
         * bukan satu pilihan atau satu deret karakter. */
        type: 'order'
        tiles: number[]
      }
    | {
        /** Menghitung. Papannya cuma tampilan — jawabannya angka lewat papan tombol yang sama
         * dengan soal Hitung, jadi tidak ada komponen input baru yang perlu dibuat. */
        type: 'count'
        options: SelectOption[]
        answerLength: number
      }
  )

type GeneratedByFactory = 'id' | 'difficulty' | 'maxReward' | 'type'

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
  order: 'Urutkan Angka',
  count: 'Hitung Bentuk',
}

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard']

export const TEXT_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TEXT_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const TEXT_DIGITS = '23456789'

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

const UINT32_RANGE = 4_294_967_296

function randomInt(max: number): number {
  if (max <= 1) return 0
  const ceiling = Math.floor(UINT32_RANGE / max) * max
  const buffer = new Uint32Array(1)
  let draw = ceiling
  while (draw >= ceiling) {
    crypto.getRandomValues(buffer)
    draw = buffer[0]
  }
  return draw % max
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

/** Tiap varian memilih sendiri judul, instruksi, dan pengali par time-nya. Par time bukan selera:
 * angkanya diturunkan dari berapa lama varian itu benar-benar dikerjakan dibanding varian asalnya,
 * dan dari headroom yang sudah ada di produksi — median pengerjaan Mudah 6,9 detik pada par 9 detik,
 * Sedang 8,6 pada 15, Sulit 11,6 pada 23. Yang paling sempit Mudah, jadi varian yang lebih berat
 * di situ butuh pengali yang lebih besar, bukan lebih kecil. */

function createTextChallenge(difficulty: Difficulty, variant: TextVariant): DraftFor<'text'> {
  const length = textLength(difficulty)
  const pick = (pool: string) => pool[randomInt(pool.length)]

  if (variant === 'letters') {
    /** Dijamin ada huruf dan ada angka: tanpa angka soalnya berubah jadi `copy` biasa, dan tanpa
     * huruf tidak ada yang bisa diketik sama sekali. */
    const digits = randomBetween(1, Math.max(1, Math.floor(length / 2)))
    const chars = [
      ...Array.from({ length: length - digits }, () => pick(TEXT_LETTERS)),
      ...Array.from({ length: digits }, () => pick(TEXT_DIGITS)),
    ]
    const display = shuffle(chars).join('')
    const answer = display.replace(/[^A-Z]/g, '')
    return {
      title: 'Saring Huruf',
      variant,
      parScale: 1.6,
      instruction: 'Ketik hurufnya saja, lewati angkanya.',
      display,
      answerLength: answer.length,
      answer,
    }
  }

  let display = ''
  for (let i = 0; i < length; i++) display += TEXT_CHARS[randomInt(TEXT_CHARS.length)]

  if (variant === 'reverse') {
    const answer = [...display].reverse().join('')
    return {
      title: 'Ketik Terbalik',
      variant,
      parScale: 1.7,
      instruction: 'Ketik karakter di bawah ini dari belakang ke depan.',
      display,
      answerLength: answer.length,
      answer,
    }
  }

  return {
    title: CHALLENGE_TITLE.text,
    variant,
    parScale: 1,
    instruction: 'Ketik ulang karakter di bawah ini.',
    display,
    answerLength: display.length,
    answer: display.toUpperCase(),
  }
}

function createMathChallenge(difficulty: Difficulty, variant: MathVariant): DraftFor<'math'> {
  const digits = mathDigits(difficulty)
  const minResult = 10 ** (digits - 1)
  const maxResult = Math.min(10 ** digits - 1, mathCeiling(difficulty))

  if (variant === 'missing') {
    /** Hanya tambah dan kurang: operan yang hilang pada perkalian menuntut pembagian, dan itu
     * lompatan kesulitan yang jauh lebih besar daripada yang dimaksud varian ini.
     *
     * Yang dijaga jumlah digitnya adalah ANGKA YANG HILANG, bukan hasil penjumlahannya — di varian
     * ini jawabannyalah yang diketik user, jadi `mathDigits` harus mengikat di situ supaya arti
     * field itu di panel tetap sama untuk semua varian. */
    const missing = randomBetween(minResult, maxResult)
    const known = randomBetween(1, maxResult)
    const sum = known + missing
    return {
      title: 'Angka Hilang',
      variant,
      parScale: 1.4,
      instruction: 'Cari angka yang hilang.',
      expression: randomInt(2) === 0 ? `${known} + ? = ${sum}` : `${sum} - ? = ${known}`,
      answerLength: digits,
      answer: String(missing),
    }
  }

  const operator = pickOne(difficulty === 'Hard' ? ['+', '-', '×'] : ['+', '-'])
  const base = { title: CHALLENGE_TITLE.math, variant, parScale: 1, instruction: 'Hitung dan masukkan hasilnya.' } as const

  if (operator === '×') {
    const [x, y] = pickFactorPair(minResult, maxResult)
    return { ...base, expression: `${x} × ${y}`, answer: String(x * y), answerLength: digits }
  }

  if (operator === '+') {
    const result = randomBetween(minResult, maxResult)
    const a = randomBetween(1, result - 1)
    return { ...base, expression: `${a} + ${result - a}`, answer: String(result), answerLength: digits }
  }

  const result = randomBetween(minResult, Math.max(minResult, maxResult - 1))
  const low = randomBetween(1, maxResult - result)
  return { ...base, expression: `${result + low} - ${low}`, answer: String(result), answerLength: digits }
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

function createSelectChallenge(difficulty: Difficulty, variant: SelectVariant): DraftFor<'select'> {
  const count = selectOptionCount(difficulty)
  const pool = shuffle(SELECT_ITEMS)
  const asOptions = (items: typeof SELECT_ITEMS) =>
    items.map((item) => ({ key: item.key, label: item.label }))

  /** Dua varian di bawah butuh minimal tiga petak untuk punya arti: pada dua petak, "beda sendiri"
   * berlaku untuk keduanya dan "muncul dua kali" berlaku untuk semuanya. `selectOptions*` boleh
   * disetel serendah 2 dari panel, jadi keadaan itu harus punya jawaban — dan jawabannya kembali
   * ke varian aslinya, bukan soal yang tidak bisa dijawab. */
  const playable = count >= 3 ? variant : 'shape'

  if (playable === 'odd') {
    const [odd, common] = pool
    return {
      title: 'Beda Sendiri',
      variant: playable,
      parScale: 1.3,
      instruction: 'Pilih objek yang bentuknya beda sendiri.',
      options: asOptions(shuffle([odd, ...Array.from({ length: count - 1 }, () => common)])),
      answer: odd.key,
    }
  }

  if (playable === 'duplicate') {
    const [twin, ...rest] = pool.slice(0, count - 1)
    return {
      title: 'Cari Kembaran',
      variant: playable,
      parScale: 1.5,
      instruction: 'Pilih bentuk yang muncul dua kali.',
      options: asOptions(shuffle([twin, twin, ...rest])),
      answer: twin.key,
    }
  }

  const options = pool.slice(0, count)
  const target = pickOne(options)
  return {
    title: CHALLENGE_TITLE.select,
    variant: playable,
    parScale: 1,
    instruction: `Pilih objek berbentuk ${target.label.toLowerCase()}.`,
    options: asOptions(options),
    answer: target.key,
  }
}

/** Petak yang harus diketuk berurutan. Dibatasi enam walau `selectOptions` boleh sampai sembilan:
 * mengetuk sembilan petak berurutan berubah dari soal jadi pekerjaan, dan par time-nya akan menuntut
 * pengali yang membuat varian ini jauh lebih menguntungkan daripada yang lain. */
const MAX_ORDER_TILES = 6

function createOrderChallenge(difficulty: Difficulty, variant: OrderVariant): DraftFor<'order'> {
  const count = Math.min(MAX_ORDER_TILES, Math.max(3, selectOptionCount(difficulty)))
  const ceiling = mathCeiling(difficulty)

  /** Angkanya wajib unik: dua petak bernilai sama membuat "urutan yang benar" ada lebih dari satu,
   * dan jawaban yang benar akan ditolak. */
  const values = new Set<number>()
  while (values.size < count) values.add(randomBetween(1, Math.max(count * 3, ceiling)))
  const tiles = shuffle([...values])

  const sorted = [...tiles].sort((a, b) => (variant === 'descending' ? b - a : a - b))
  return {
    title: CHALLENGE_TITLE.order,
    variant,
    parScale: 1.8,
    instruction:
      variant === 'descending'
        ? 'Ketuk angka berurutan dari yang terbesar.'
        : 'Ketuk angka berurutan dari yang terkecil.',
    tiles,
    answer: sorted.join('-'),
  }
}

function createCountChallenge(difficulty: Difficulty, variant: CountVariant): DraftFor<'count'> {
  const slots = selectOptionCount(difficulty)
  const pool = shuffle(SELECT_ITEMS)
  const target = pool[0]

  /** Minimal dua, dan tidak pernah seluruh papan: satu membuat soalnya sama dengan "pilih bentuk",
   * dan seluruh papan membuat jawabannya bisa ditebak tanpa melihat. */
  const targetCount = randomBetween(2, Math.max(2, slots - 2))
  const filler = pool.slice(1)
  const board = shuffle([
    ...Array.from({ length: targetCount }, () => target),
    ...Array.from({ length: slots - targetCount }, () => filler[randomInt(filler.length)]),
  ])

  return {
    title: CHALLENGE_TITLE.count,
    variant,
    parScale: 1.6,
    instruction: `Ada berapa ${target.label.toLowerCase()} di papan?`,
    options: board.map((item) => ({ key: item.key, label: item.label })),
    answerLength: String(targetCount).length,
    answer: String(targetCount),
  }
}

/** Jawaban soal Urutkan Angka, dibangun dari urutan ketukan.
 *
 * Ada di sini, bukan di hook captcha, karena inilah satu-satunya tempat bentuk jawabannya
 * ditentukan — dan versi pertama fitur ini mengirim INDEKS petak sementara `createOrderChallenge`
 * menyimpan NILAI petak, sehingga tidak ada urutan ketukan apa pun yang bisa dinilai benar.
 * Kegagalannya diam: user melihat "jawaban salah" pada urutan yang jelas benar, energinya tetap
 * terpotong, dan tidak ada satu pun error yang tercatat. Menaruh pembangunnya berdampingan dengan
 * pembuat jawabannya membuat kedua sisi bisa dikunci satu test. */
export function orderAnswerFromPicks(tiles: readonly number[], picks: readonly number[]): string {
  return picks.map((index) => tiles[index]).join('-')
}

let counter = 0
function createChallengeId() {
  counter += 1
  return `ch_${Date.now().toString(36)}_${counter}`
}

/** Varian yang tersedia per tipe. Diundi seragam seperti tipe dan kesulitannya, jadi menambah satu
 * varian di sini langsung menambah bentuk yang mungkin muncul tanpa menyentuh apa pun yang lain. */
export const TEXT_VARIANTS: readonly TextVariant[] = ['copy', 'reverse', 'letters']
export const MATH_VARIANTS: readonly MathVariant[] = ['result', 'missing']
export const SELECT_VARIANTS: readonly SelectVariant[] = ['shape', 'duplicate', 'odd']
export const ORDER_VARIANTS: readonly OrderVariant[] = ['ascending', 'descending']
export const COUNT_VARIANTS: readonly CountVariant[] = ['shape']

export function generateChallenge(opts?: {
  type?: CaptchaType
  difficulty?: Difficulty
  variant?: ChallengeVariant
}): GeneratedChallenge {
  const type = opts?.type ?? pickOne(CAPTCHA_TYPES)
  const difficulty = opts?.difficulty ?? pickOne(DIFFICULTIES)
  const meta = {
    id: createChallengeId(),
    difficulty,
    maxReward: getMaxReward(difficulty),
  }

  switch (type) {
    case 'text':
      return {
        ...meta,
        type,
        ...createTextChallenge(difficulty, (opts?.variant as TextVariant) ?? pickOne(TEXT_VARIANTS)),
      }
    case 'math':
      return {
        ...meta,
        type,
        ...createMathChallenge(difficulty, (opts?.variant as MathVariant) ?? pickOne(MATH_VARIANTS)),
      }
    case 'select':
      return {
        ...meta,
        type,
        ...createSelectChallenge(
          difficulty,
          (opts?.variant as SelectVariant) ?? pickOne(SELECT_VARIANTS),
        ),
      }
    case 'order':
      return {
        ...meta,
        type,
        ...createOrderChallenge(
          difficulty,
          (opts?.variant as OrderVariant) ?? pickOne(ORDER_VARIANTS),
        ),
      }
    case 'count':
      return {
        ...meta,
        type,
        ...createCountChallenge(
          difficulty,
          (opts?.variant as CountVariant) ?? pickOne(COUNT_VARIANTS),
        ),
      }
  }
}

/** Payload lama tidak punya `variant`, `parScale`, maupun `answerLength` — baris `challenges` yang
 * sudah tersimpan sebelum varian ada tetap harus bisa dikerjakan sampai selesai. Nilai bawaannya
 * dipilih supaya baris lama berperilaku persis seperti dulu. */
export function withVariantDefaults<T extends { type: CaptchaType }>(payload: T): T {
  const base = payload as T & Record<string, unknown>
  const filled: Record<string, unknown> = {
    variant:
      base.variant ??
      (base.type === 'math' ? 'result' : base.type === 'text' ? 'copy' : base.type === 'order' ? 'ascending' : 'shape'),
    parScale: typeof base.parScale === 'number' ? base.parScale : 1,
  }
  if (base.type === 'text' && typeof base.answerLength !== 'number') {
    filled.answerLength = String(base.display ?? '').length
  }
  return { ...base, ...filled } as T
}

