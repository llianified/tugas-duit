'use client'

import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/utils'

type FieldSize = 'md' | 'compact'

const SIZE_CLASS: Record<FieldSize, string> = {
  md: 'control-h px-3 text-sm',
  compact: 'control-h-compact px-3 text-sm',
}

function fieldClass(size: FieldSize, invalid: boolean, tone: 'muted' | 'card') {
  return cn(
    'focus-ring transition-ui w-full rounded-lg placeholder:text-muted-foreground',
    SIZE_CLASS[size],
    invalid
      ? 'bg-destructive/10 text-destructive'
      : tone === 'card'
        ? 'bg-background text-foreground'
        : 'bg-muted text-foreground',
  )
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: FieldSize
  invalid?: boolean
  tone?: 'muted' | 'card'
  ref?: Ref<HTMLInputElement>
}

export function TextInput({
  size = 'md',
  invalid = false,
  tone = 'muted',
  className,
  ...props
}: TextInputProps) {
  return <input {...props} className={cn(fieldClass(size, invalid, tone), className)} />
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  tone?: 'muted' | 'card'
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({
  invalid = false,
  tone = 'muted',
  className,
  ...props
}: TextAreaProps) {
  return (
    <textarea
      {...props}
      className={cn(
        'focus-ring transition-ui w-full rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground',
        invalid
          ? 'bg-destructive/10 text-destructive'
          : tone === 'card'
            ? 'bg-background text-foreground'
            : 'bg-muted text-foreground',
        className,
      )}
    />
  )
}
