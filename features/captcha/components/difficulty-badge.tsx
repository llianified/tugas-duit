'use client'

import { DIFFICULTY_LABEL, type Difficulty } from '@/features/captcha/domain'
import { BADGE_SHAPE } from '@/shared/components/meta-badge'

const DIFFICULTY_STRENGTH: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
}

const SEGMENT_COUNT = 3

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`${BADGE_SHAPE} inline-flex shrink-0 items-center gap-1.5 bg-muted font-semibold text-muted-foreground`}
    >
      <DifficultyMeter difficulty={difficulty} />
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  )
}

export function DifficultyMeter({ difficulty }: { difficulty: Difficulty }) {
  const strength = DIFFICULTY_STRENGTH[difficulty]

  return (
    <span aria-hidden="true" className="flex shrink-0 items-center gap-[2px]">
      {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
        <span
          key={index}
          className={`h-2.5 w-[3px] rounded-full ${
            index < strength ? 'bg-foreground/70' : 'bg-foreground/15'
          }`}
        />
      ))}
    </span>
  )
}
