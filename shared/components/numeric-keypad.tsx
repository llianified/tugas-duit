'use client'

import { GlyphBackspace } from '@/shared/components/glyph'
import { KeypadFrame, KeypadKey } from '@/shared/components/keypad-frame'

const NUMERIC_ROWS = ['123', '456', '789']

function keepCurrentFocus(event: React.PointerEvent<HTMLButtonElement>) {
  event.preventDefault()
}

interface NumericKeypadProps {
  ariaLabel: string
  heightClass: string
  empty: boolean
  full?: boolean
  disabled?: boolean
  preserveFocus?: boolean
  onDigit: (digit: string) => void
  onBackspace: () => void
}

export function NumericKeypad({
  ariaLabel,
  heightClass,
  empty,
  full = false,
  disabled = false,
  preserveFocus = false,
  onDigit,
  onBackspace,
}: NumericKeypadProps) {
  const pointerHandler = preserveFocus ? keepCurrentFocus : undefined

  return (
    <KeypadFrame
      role="group"
      aria-label={ariaLabel}
      className={heightClass}
    >
      <div className="grid min-h-0 flex-1 grid-rows-4 gap-1.5">
        {NUMERIC_ROWS.map((row) => (
          <div key={row} className="grid grid-cols-3 gap-1.5">
            {[...row].map((digit) => (
              <KeypadKey
                key={digit}
                disabled={disabled || full}
                onPointerDown={pointerHandler}
                onPress={() => onDigit(digit)}
                className="text-xl"
              >
                {digit}
              </KeypadKey>
            ))}
          </div>
        ))}

        <div className="grid grid-cols-3 gap-1.5">
          <span aria-hidden />
          <KeypadKey
            disabled={disabled || full}
            onPointerDown={pointerHandler}
            onPress={() => onDigit('0')}
            className="text-xl"
          >
            0
          </KeypadKey>
          <KeypadKey
            disabled={disabled || empty}
            onPointerDown={pointerHandler}
            onPress={onBackspace}
            aria-label="Hapus satu karakter"
            className="text-xl"
          >
            <GlyphBackspace className="size-5" />
          </KeypadKey>
        </div>
      </div>
    </KeypadFrame>
  )
}
