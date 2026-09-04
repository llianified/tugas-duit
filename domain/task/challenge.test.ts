import { describe, expect, it } from 'vitest'
import { DEFAULT_ECONOMY_CONFIG } from '../economy/economy-config'
import { DIFFICULTY_LABEL, generateChallenge, TEXT_CHARS } from './challenge'

describe('challenge domain', () => {
  it('menyediakan label untuk setiap kesulitan', () => {
    expect(Object.keys(DIFFICULTY_LABEL)).toEqual(['Easy', 'Medium', 'Hard'])
  })

  it.each(['Easy', 'Medium', 'Hard'] as const)('membuat text challenge %s yang valid', (difficulty) => {
    const challenge = generateChallenge({ type: 'text', difficulty })

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
    const challenge = generateChallenge({ type: 'select', difficulty: 'Hard' })

    expect(challenge.type).toBe('select')
    if (challenge.type !== 'select') return
    const keys = challenge.options.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain(challenge.answer)
  })
})
