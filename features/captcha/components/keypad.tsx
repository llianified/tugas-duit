'use client'

import { GlyphBackspace } from '@/shared/components/glyph'
import { NumericKeypad } from '@/shared/components/numeric-keypad'
import {
  KEYPAD_HEIGHT_CLASS,
  KeypadFrame,
  KeypadKey,
} from '@/shared/components/keypad-frame'
import { TEXT_CHARS } from '@/domain/task/challenge'
import { cn } from '@/shared/lib/utils'

const QWERTY_ROWS = ['23456789', 'QWERTYUP', 'ASDFGHJKL', 'ZXCVBNM'] as const

const HALF_COLUMNS = 18

const ROW_START_CLASS = ['col-start-1', 'col-start-2', 'col-start-3'] as const

function rowOffset(row: string): number {
  return Math.floor((HALF_COLUMNS - row.length * 2) / 2)
}

if (process.env.NODE_ENV !== 'production') {
  const onBoard = QWERTY_ROWS.join('')
  const sorted = (value: string) => [...value].sort().join('')
  if (sorted(onBoard) !== sorted(TEXT_CHARS)) {
    console.error('[v0] Susunan papan tidak sama dengan TEXT_CHARS', {
      board: onBoard,
      chars: TEXT_CHARS,
    })
  }
  for (const row of QWERTY_ROWS) {
    const offset = rowOffset(row)
    if (offset < 0 || offset >= ROW_START_CLASS.length) {
      console.error('[v0] Baris papan tidak bisa dipusatkan di 18 setengah-kolom', {
        row,
        offset,
      })
    }
  }
}

interface CaptchaKeypadProps {
  layout: 'numeric' | 'alphanumeric'
  full: boolean
  empty: boolean
  disabled?: boolean
  onKey: (char: string) => void
  onBackspace: () => void
}

export function CaptchaKeypad({
  layout,
  full,
  empty,
  disabled = false,
  onKey,
  onBackspace,
}: CaptchaKeypadProps) {
  if (layout === 'numeric') {
    return (
      <NumericKeypad
        ariaLabel="Papan tombol jawaban"
        heightClass={KEYPAD_HEIGHT_CLASS}
        full={full}
        empty={empty}
        disabled={disabled}
        preserveFocus
        onDigit={onKey}
        onBackspace={onBackspace}
      />
    )
  }

  return (
    <KeypadFrame
      role="group"
      aria-label="Papan tombol jawaban"
      className={KEYPAD_HEIGHT_CLASS}
    >
      <div className="grid min-h-0 flex-1 grid-rows-5 gap-1">
        <div className="row-span-4 grid grid-rows-4 gap-1">
          {QWERTY_ROWS.map((row) => (
            <div key={row} className="grid grid-cols-18 gap-x-1">
              {[...row].map((char, index) => (
                <Key
                  key={char}
                  char={char}
                  className={cn(
                    'col-span-2 text-base',
                    index === 0 && ROW_START_CLASS[rowOffset(row)],
                  )}
                  disabled={disabled || full}
                  onPress={onKey}
                />
              ))}
            </div>
          ))}
        </div>
        <BackspaceKey disabled={disabled || empty} onPress={onBackspace} />
      </div>
    </KeypadFrame>
  )
}

function keepFocusOnAnswer(event: React.PointerEvent<HTMLButtonElement>) {
  event.preventDefault()
}

function Key({
  char,
  className,
  disabled,
  onPress,
}: {
  char: string
  className?: string
  disabled: boolean
  onPress: (char: string) => void
}) {
  return (
    <KeypadKey
      disabled={disabled}
      onPointerDown={keepFocusOnAnswer}
      onPress={() => onPress(char)}
      className={className}
    >
      {char}
    </KeypadKey>
  )
}

function BackspaceKey({
  className,
  disabled,
  onPress,
}: {
  className?: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <KeypadKey
      disabled={disabled}
      onPointerDown={keepFocusOnAnswer}
      onPress={onPress}
      aria-label="Hapus satu karakter"
      className={className}
    >
      <GlyphBackspace className="size-5" />
    </KeypadKey>
  )
}
