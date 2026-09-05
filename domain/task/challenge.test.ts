import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG } from '../economy/economy-config'
import { economyConfig, setActiveEconomyConfig } from '../economy/economy-config'
import {
  DIFFICULTY_LABEL,
  generateChallenge,
  withVariantDefaults,
  TEXT_CHARS,
} from './challenge'

describe('challenge domain', () => {
  it('menyediakan label untuk setiap kesulitan', () => {
    expect(Object.keys(DIFFICULTY_LABEL)).toEqual(['Easy', 'Medium', 'Hard'])
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('membuat text challenge %s yang valid', (difficulty) => {
    const challenge = generateChallenge({ type: 'text', difficulty, variant: 'copy' })

    expect(challenge.type).toBe('text')
    if (challenge.type !== 'text') return
    expect(challenge.display).toHaveLength(
      DEFAULT_ECONOMY_CONFIG[`textLength${difficulty}`],
    )
    expect([...challenge.display].every((character) => TEXT_CHARS.includes(character))).toBe(true)
    expect(challenge.answer).toBe(challenge.display)
    expect(challenge.maxReward).toBeGreaterThan(0)
  })

  it('membuat opsi bentuk unik dan jawaban yang tersedia', () => {
    const challenge = generateChallenge({ type: 'select', difficulty: 'Hard', variant: 'shape' })

    expect(challenge.type).toBe('select')
    if (challenge.type !== 'select') return
    const keys = challenge.options.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain(challenge.answer)
  })
})

/** Varian ditambahkan untuk menambah isi, bukan untuk menggeser ekonomi. Dua hal karena itu harus
 * dijaga bersamaan: soalnya benar-benar bisa dikerjakan, dan `parScale`-nya sebanding dengan berapa
 * lama varian itu dikerjakan. Yang kedua yang mudah lolos tanpa test — varian lebih lambat pada par
 * time yang sama akan menurunkan laju bintang, dan itu potongan reward yang tidak pernah diputuskan
 * siapa pun. */
describe('varian soal', () => {
  it.each(['Easy', 'Medium', 'Hard'] as const)('varian ketik terbalik %s membalik jawabannya', (difficulty) => {
    const c = generateChallenge({ type: 'text', difficulty, variant: 'reverse' })
    if (c.type !== 'text') throw new Error('tipe salah')
    expect(c.answer).toBe([...c.display].reverse().join('').toUpperCase())
    expect(c.answerLength).toBe(c.display.length)
    expect(c.parScale).toBeGreaterThan(1)
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('varian saring huruf %s membuang angkanya', (difficulty) => {
    const c = generateChallenge({ type: 'text', difficulty, variant: 'letters' })
    if (c.type !== 'text') throw new Error('tipe salah')
    expect(c.answer).toBe(c.display.replace(/[^A-Z]/g, ''))
    expect(c.answerLength).toBe(c.answer.length)
    /** Soalnya harus punya keduanya: tanpa angka ia cuma `copy`, tanpa huruf tak ada yang diketik. */
    expect(c.answer.length).toBeGreaterThan(0)
    expect(c.answer.length).toBeLessThan(c.display.length)
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('varian angka hilang %s punya jawaban tunggal yang benar', (difficulty) => {
    const c = generateChallenge({ type: 'math', difficulty, variant: 'missing' })
    if (c.type !== 'math') throw new Error('tipe salah')
    const [left, op, , , right] = c.expression.split(' ')
    const solved = op === '+' ? Number(right) - Number(left) : Number(left) - Number(right)
    expect(String(solved)).toBe(c.answer)
    /** Digit jawaban tetap mengikuti `mathDigits`, sama seperti varian aslinya — kalau tidak,
     * arti field itu di panel berubah diam-diam untuk sepertiga soal Hitung. */
    expect(c.answerLength).toBe(DEFAULT_ECONOMY_CONFIG[`mathDigits${difficulty}`])
    expect(c.answer).toHaveLength(c.answerLength)
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('varian cari kembaran %s memunculkan tepat satu bentuk dua kali', (difficulty) => {
    const c = generateChallenge({ type: 'select', difficulty, variant: 'duplicate' })
    if (c.type !== 'select') throw new Error('tipe salah')
    /** Jumlah petaknya tetap mengikuti `selectOptions*`, sama seperti varian aslinya. */
    expect(c.options).toHaveLength(DEFAULT_ECONOMY_CONFIG[`selectOptions${difficulty}`])
    const counts = new Map<string, number>()
    for (const o of c.options) counts.set(o.key, (counts.get(o.key) ?? 0) + 1)
    const twins = [...counts.entries()].filter(([, n]) => n > 1)
    expect(twins).toHaveLength(1)
    expect(twins[0][0]).toBe(c.answer)
    expect(twins[0][1]).toBe(2)
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('varian beda sendiri %s menyisakan tepat satu bentuk yang tidak seragam', (difficulty) => {
    const c = generateChallenge({ type: 'select', difficulty, variant: 'odd' })
    if (c.type !== 'select') throw new Error('tipe salah')
    expect(c.options).toHaveLength(DEFAULT_ECONOMY_CONFIG[`selectOptions${difficulty}`])
    const counts = new Map<string, number>()
    for (const o of c.options) counts.set(o.key, (counts.get(o.key) ?? 0) + 1)
    expect(counts.get(c.answer)).toBe(1)
    expect(counts.size).toBe(2)
  })

  it('setiap varian punya instruksi sendiri, karena di situlah aturan mainnya dibaca', () => {
    const seen = new Set<string>()
    for (const variant of ['copy', 'reverse', 'letters'] as const) {
      const c = generateChallenge({ type: 'text', difficulty: 'Medium', variant })
      expect(c.instruction.length).toBeGreaterThan(0)
      seen.add(c.instruction)
    }
    expect(seen.size).toBe(3)
  })

  it('mengundi varian dari seluruh kolam, bukan satu saja', () => {
    const variants = new Set<string>()
    for (let i = 0; i < 300; i += 1) variants.add(generateChallenge().variant)
    expect(variants.size).toBeGreaterThanOrEqual(7)
  })
})

describe('withVariantDefaults', () => {
  /** Baris `challenges` yang tersimpan sebelum varian ada harus tetap bisa diselesaikan, dan harus
   * berperilaku persis seperti dulu — bukan mendapat jendela bintang yang lebih longgar. */
  it('memulihkan payload text lama tanpa menggeser par time-nya', () => {
    const old = { type: 'text' as const, display: 'AB3D', title: 'x', instruction: 'y', difficulty: 'Easy' as const, maxReward: 3 }
    const filled = withVariantDefaults(old as never) as Record<string, unknown>
    expect(filled.parScale).toBe(1)
    expect(filled.variant).toBe('copy')
    expect(filled.answerLength).toBe(4)
  })

  it('tidak menimpa payload yang sudah membawa variannya', () => {
    const fresh = generateChallenge({ type: 'text', difficulty: 'Hard', variant: 'reverse' })
    const filled = withVariantDefaults(fresh)
    expect(filled.variant).toBe('reverse')
    expect(filled.parScale).toBe(fresh.parScale)
  })
})

/** Dua petak membuat "beda sendiri" dan "cari kembaran" tidak punya jawaban tunggal. Panel boleh
 * menyetel `selectOptions*` serendah 2, jadi keadaan itu harus berakhir di soal yang bisa dijawab. */
it('menurunkan varian select yang mustahil saat petaknya cuma dua', () => {
  /** Config aktif itu singleton lintas modul, jadi pemulihannya wajib lewat `finally` dan wajib
   * mengembalikan nilai yang TADI berlaku — bukan bawaan repo. Tanpa keduanya, kegagalan di tengah
   * test ini akan bocor jadi kegagalan di file lain yang jalan sesudahnya. */
  const sebelumnya = economyConfig()
  try {
    setActiveEconomyConfig({ ...sebelumnya, selectOptionsEasy: 2 })
    for (const variant of ['odd', 'duplicate'] as const) {
      const c = generateChallenge({ type: 'select', difficulty: 'Easy', variant })
      if (c.type !== 'select') throw new Error('tipe salah')
      expect(c.options).toHaveLength(2)
      expect(c.variant).toBe('shape')
      expect(c.options.map((o) => o.key)).toContain(c.answer)
    }
  } finally {
    setActiveEconomyConfig(sebelumnya)
  }
})
