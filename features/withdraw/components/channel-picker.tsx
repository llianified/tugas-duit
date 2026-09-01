'use client'

import { Select } from '@base-ui/react/select'
import { GlyphCheck, GlyphChevron, GlyphWallet } from '@/shared/components/glyph'
import { PAYOUT_CHANNELS, getPayoutChannel, type PayoutChannel } from '@/features/withdraw/domain'
import { hapticSelect } from '@/shell/haptic'
import { cn } from '@/shared/lib/utils'

export const KIND_LABEL: Record<PayoutChannel['kind'], string> = {
  ewallet: 'E-wallet',
  bank: 'Bank',
}

export function ChannelSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (channelId: string) => void
}) {
  const channel = getPayoutChannel(value)

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next !== 'string' || next === value) return
        hapticSelect()
        onChange(next)
      }}
    >
      <Select.Trigger
        aria-label={`Tujuan transfer: ${channel.name}. Ketuk untuk mengganti.`}
        className="focus-ring transition-ui press-scale-soft control-h flex w-full items-center gap-2 rounded-lg bg-muted px-3 text-left hover:bg-muted-foreground/15"
      >
        <GlyphWallet className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{channel.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{KIND_LABEL[channel.kind]}</span>
        <Select.Icon className="ml-auto flex shrink-0 text-muted-foreground">
          <GlyphChevron
            direction="down"
            className="size-4 transition-transform duration-150 ease-out group-data-[popup-open]/trigger:rotate-180 motion-reduce:transition-none"
          />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          side="top"
          align="start"
          sideOffset={6}
          alignItemWithTrigger={false}
          className="z-50 w-[var(--anchor-width)] outline-none"
        >
          <Select.Popup className="channel-popup max-h-64 w-full overflow-y-auto overscroll-contain rounded-lg border border-border bg-card p-1 outline-none">
            {PAYOUT_CHANNELS.map((option) => (
              <Select.Item
                key={option.id}
                value={option.id}
                className={cn(
                  'focus-ring transition-ui flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-left',
                  'data-[highlighted]:bg-muted data-[selected]:text-primary',
                )}
              >
                <Select.ItemText className="min-w-0 flex-1 truncate text-sm font-medium">
                  {option.name}
                </Select.ItemText>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {KIND_LABEL[option.kind]}
                </span>
                <Select.ItemIndicator className="flex shrink-0">
                  <GlyphCheck className="size-4 text-primary" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
