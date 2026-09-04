'use client'

import { OTPFieldPreview as OTPField } from '@base-ui/react/otp-field'
import { useEffect, useRef } from 'react'
import { VIEW_IN_DURATION_MS } from '@/shared/lib/motion'

const FIRST_SLOT_ID = 'answer-slot'

function toUpperCase(next: string) {
  return next.toUpperCase()
}

const UNIT_LABEL: Record<'alphanumeric' | 'numeric', { one: string; many: string }> = {
  alphanumeric: { one: 'Karakter', many: 'karakter' },
  numeric: { one: 'Angka', many: 'angka' },
}

interface CaptchaAnswerSlotsProps {
  value: string
  length: number
  validationType: 'alphanumeric' | 'numeric'
  uppercase?: boolean
  hasError: boolean
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export function CaptchaAnswerSlots({
  value,
  length,
  validationType,
  uppercase = false,
  hasError,
  disabled = false,
  onChange,
  onSubmit,
}: CaptchaAnswerSlotsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const unit = UNIT_LABEL[validationType]

  const ready = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      ready.current = true
      const first = document.getElementById(FIRST_SLOT_ID)
      if (!(first instanceof HTMLInputElement)) return
      first.dataset.autofocus = 'true'
      first.focus()
    }, VIEW_IN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [])

  function clearAutofocusMark() {
    delete document.getElementById(FIRST_SLOT_ID)?.dataset.autofocus
  }

  useEffect(() => {
    if (disabled || !ready.current) return
    const inputs =
      containerRef.current?.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')
    if (!inputs?.length) return
    inputs[Math.min(value.length, inputs.length - 1)]?.focus()
  }, [disabled, value.length])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    clearAutofocusMark()
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === 'Enter') onSubmit()
  }

  return (
    <div>
      <label htmlFor={FIRST_SLOT_ID} className="sr-only">
        Jawaban, {length} {unit.many}, {unit.one} ke-1
      </label>
      <OTPField.Root
        ref={containerRef}
        id={FIRST_SLOT_ID}
        length={length}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        validationType={validationType}
        inputMode="none"
        normalizeValue={uppercase ? toUpperCase : undefined}
        onKeyDown={handleKeyDown}
        onPointerDown={clearAutofocusMark}
        className={`flex justify-center gap-1.5 ${hasError ? 'animate-answer-shake' : ''}`}
      >
        {Array.from({ length }, (_, index) => {
          const filled = index < value.length
          return (
            <span
              key={index}
              className={`flex min-w-0 shrink transition-transform duration-150 ease-out motion-reduce:transition-none ${
                filled ? 'scale-100' : 'scale-[0.97]'
              }`}
            >
              <OTPField.Input
                aria-label={`${unit.one} ke-${index + 1}`}
                aria-invalid={hasError}
                className={`focus-ring transition-ui size-12 min-w-0 shrink rounded-lg text-center text-2xl font-bold tabular-nums disabled:opacity-50 ${
                  hasError
                    ? 'bg-destructive/10 text-destructive'
                    : filled
                      ? 'bg-muted-foreground/15 text-foreground'
                      : 'bg-muted text-foreground'
                } ${
                  index === value.length && !hasError && !disabled ? 'slot-active' : ''
                }`}
              />
            </span>
          )
        })}
      </OTPField.Root>
    </div>
  )
}
