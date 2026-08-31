'use client'

import type { ReactNode } from 'react'
import { GlyphShape } from '@/features/captcha/components/glyph-shape'
import type { SelectOption } from '@/features/captcha/domain'
import type { CaptchaAttemptStatus } from '@/features/captcha/hooks/use-captcha-attempt'
import { hapticSelect } from '@/shell/haptic'

const BOARD_CONTENT_CLASS = 'flex min-h-16 flex-1 select-none items-center justify-center'

function ChallengeBoard({ children }: { children: ReactNode }) {
  return (
    <div className="challenge-board animate-board-in flex min-h-[9.5rem] max-h-56 shrink-0 flex-col items-stretch justify-center rounded-cta p-[var(--surface-p)]">
      <div className={BOARD_CONTENT_CLASS}>{children}</div>
    </div>
  )
}

function jitterRotationClass(index: number): string {
  return `jitter-rot-${JITTER_ROTATIONS[index % JITTER_ROTATIONS.length]}`
}

function jitterOffsetClass(index: number): string {
  return `jitter-dy-${JITTER_OFFSETS[index % JITTER_OFFSETS.length]}`
}

const JITTER_ROTATIONS = ['-5', '2', '-2', '5', '1', '-3', '4', '0', '-4', '3', '-1'] as const
const JITTER_OFFSETS = ['-2', '1', '-1', '2', '0'] as const

export function ChallengeText({ display }: { display: string }) {
  return (
    <ChallengeBoard>
      <div
        role="img"
        aria-label={`Karakter yang harus diketik: ${display.split('').join(' ')}`}
        className="flex items-center gap-1.5"
      >
        {display.split('').map((char, index) => (
          <span
            key={`${char}-${index}`}
            aria-hidden="true"
            className={`jitter-char ${jitterRotationClass(index)} ${jitterOffsetClass(index)} w-9 text-center text-4xl font-bold tabular-nums text-foreground`}
          >
            {char}
          </span>
        ))}
      </div>
    </ChallengeBoard>
  )
}

const SPOKEN_OPERATOR: Record<string, string> = {
  '+': 'ditambah',
  '-': 'dikurangi',
  '×': 'dikali',
}

export function ChallengeMath({ expression }: { expression: string }) {
  const spoken = expression
    .split(' ')
    .map((token) => SPOKEN_OPERATOR[token] ?? token)
    .join(' ')

  return (
    <ChallengeBoard>
      <span className="sr-only">{`Hitung ${spoken}`}</span>
      <span
        aria-hidden="true"
        className="flex items-center gap-2 text-4xl font-bold tracking-wide tabular-nums text-foreground"
      >
        {expression.split(' ').map((token, index) => (
          <span key={index} className={SPOKEN_OPERATOR[token] ? 'text-primary' : undefined}>
            {token}
          </span>
        ))}
        <span className="text-muted-foreground">=</span>
      </span>
    </ChallengeBoard>
  )
}

const SELECT_TARGET_PATTERN = /^.*\bberbentuk\s+(.+?)\.?$/i

function selectTarget(instruction: string): string {
  const trimmed = instruction.trim()
  return SELECT_TARGET_PATTERN.exec(trimmed)?.[1] ?? trimmed
}

export function ChallengeSelectBoard({ instruction }: { instruction: string }) {
  const target = selectTarget(instruction)

  return (
    <ChallengeBoard>
      <span className="sr-only">{instruction}</span>
      <span
        aria-hidden="true"
        className="text-center text-4xl font-bold tracking-tight text-foreground text-balance"
      >
        {target}
      </span>
    </ChallengeBoard>
  )
}

export function ChallengeSelect({
  options,
  selected,
  status,
  disabled = false,
  onSelect,
}: {
  options: SelectOption[]
  selected: string | null
  status: CaptchaAttemptStatus
  disabled?: boolean
  onSelect: (key: string) => void
}) {
  const columns = options.length % 3 === 0 ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div
      role="radiogroup"
      aria-label="Pilihan bentuk"
      aria-invalid={status === 'error'}
      className={`grid min-h-0 flex-1 gap-2 [grid-auto-rows:minmax(4rem,1fr)] ${columns}`}
    >
      {options.map((option) => {
        const isSelected = selected === option.key
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            onClick={() => {
              hapticSelect()
              onSelect(option.key)
            }}
            aria-checked={isSelected}
            aria-label={option.label}
            disabled={disabled}
            className={`focus-ring focus-ring-strong transition-ui press-scale flex h-full items-center justify-center rounded-lg ${optionStateClass(isSelected, status)} ${
              disabled && !isSelected ? 'opacity-40' : ''
            }`}
          >
            <GlyphShape shape={option.key} className="size-8" />
          </button>
        )
      })}
    </div>
  )
}

function optionStateClass(isSelected: boolean, status: CaptchaAttemptStatus): string {
  if (!isSelected) {
    return 'bg-muted text-foreground hover:bg-muted-foreground/15 active:bg-muted-foreground/25'
  }
  if (status === 'error') return 'bg-destructive/15 text-destructive'
  if (status === 'success') return 'bg-success/15 text-success'
  return 'bg-primary/15 text-primary'
}
