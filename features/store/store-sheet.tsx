'use client'

import { Dialog } from '@base-ui/react/dialog'
import type { StoreItem } from '@/domain/store/store'
import { itemBlocker, useStore, type StoreSnapshot } from '@/features/store/use-store'
import { ActionButton } from '@/shared/components/action-button'
import { CreditAmount } from '@/shared/components/credit-amount'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphBolt, GlyphCross, GlyphCrown, GlyphSpinner, GlyphWallet } from '@/shared/components/glyph'
import { SheetIcon } from '@/shared/components/sheet-icon'
import { Surface } from '@/shared/components/surface'
import { formatCredits } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'

/** Lembar bawah, sama seperti premium dan misi sosial: yang dilakukan di sini dipilih lalu
 * dikonfirmasi, dua aksi yang berakhir di jempol. */
export function StoreSheet({
  open,
  onOpenChange,
  onBought,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBought: () => Promise<unknown>
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="animate-in fade-in data-[ending-style]:animate-out data-[ending-style]:fade-out fixed inset-0 z-40 bg-scrim duration-150" />
        <Dialog.Popup className="sheet-popup">
          <StoreSheetBody onBought={onBought} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function StoreSheetBody({ onBought }: { onBought: () => Promise<unknown> }) {
  const { store, buying, buy } = useStore({ onBought })

  return (
    <>
      <div className="sheet-grip" aria-hidden="true" />

      <div className="flex shrink-0 items-center gap-3 px-content pt-3">
        <SheetIcon>
          <GlyphWallet className="size-4" />
        </SheetIcon>
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-sm font-semibold tracking-tight text-foreground">
            Toko TD
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
            {store ? `Saldomu ${formatCredits(store.balance)} TD` : 'Lagi dibuka…'}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label="Tutup"
          className="focus-ring transition-ui relative -mr-2 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground after:absolute after:-inset-1.5 after:content-[''] hover:text-foreground"
        >
          <GlyphCross className="size-4" />
        </Dialog.Close>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-content pb-[var(--content-px)] pt-4">
        {!store ? (
          <Surface>
            <p className="text-sm leading-relaxed text-muted-foreground">Bentar ya, lagi dibuka…</p>
          </Surface>
        ) : !store.enabled || store.items.length === 0 ? (
          <EmptyState
            icon={<GlyphWallet className="glyph-md text-muted-foreground" />}
            title="Tokonya lagi tutup"
            description="Nanti dibuka lagi. Sementara ini lanjut kumpulin TD dulu."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {store.items.map((item) => (
              <StoreRow
                key={item.key}
                item={item}
                store={store}
                buying={buying === item.key}
                onBuy={() => void buy(item.key)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

function StoreRow({
  item,
  store,
  buying,
  onBuy,
}: {
  item: StoreItem
  store: StoreSnapshot
  buying: boolean
  onBuy: () => void
}) {
  const blocker = itemBlocker(item, store)

  return (
    <li>
      <Surface>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className="stamp-portrait shrink-0">
              {item.effect.kind === 'energy' ? (
                <GlyphBolt className="stamp-ink-fg size-4" />
              ) : (
                <GlyphCrown className="stamp-ink-fg size-4" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground text-pretty">
                {item.detail}
              </p>
            </div>
          </div>
          <CreditAmount value={formatCredits(item.priceCredits)} className="shrink-0" />
        </div>

        <ActionButton
          className={cn('mt-3', blocker && 'opacity-60')}
          onClick={onBuy}
          disabled={buying || blocker !== null}
          aria-busy={buying}
        >
          {buying ? (
            <GlyphSpinner className="size-4 animate-spin motion-reduce:animate-none" />
          ) : null}
          {buying ? 'Lagi diproses…' : (blocker ?? 'Tukar sekarang')}
        </ActionButton>
      </Surface>
    </li>
  )
}
