'use client'

import { useCallback, useEffect, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import type { CosmeticKey } from '@/domain/store/cosmetics'
import { cosmetic } from '@/domain/store/cosmetics'
import type { StoreItem, StoreSection } from '@/domain/store/store'
import {
  itemBlocker,
  useStore,
  type StoreOrder,
  type StoreSnapshot,
} from '@/features/store/use-store'
import { ActionButton } from '@/shared/components/action-button'
import { CreditAmount } from '@/shared/components/credit-amount'
import { EmptyState } from '@/shared/components/empty-state'
import {
  GlyphBolt,
  GlyphCheck,
  GlyphCross,
  GlyphCrown,
  GlyphPlay,
  GlyphSpinner,
  GlyphTrophy,
  GlyphUser,
  GlyphWallet,
  GlyphWithdraw,
} from '@/shared/components/glyph'
import { MetaBadge } from '@/shared/components/meta-badge'
import { QrisPanel } from '@/shared/components/qris-panel'
import { SectionLabel } from '@/shared/components/section-label'
import { SheetIcon } from '@/shared/components/sheet-icon'
import { Surface } from '@/shared/components/surface'
import { formatCredits, formatLongCountdown, formatRupiah } from '@/shared/lib/format'
import { useToast } from '@/shell/toast'
import { cn } from '@/shared/lib/utils'

/** Jeda dan anggaran polling status pembayaran, disamakan dengan lembar premium — dan dengan alasan
 * yang sama: `/api/store` berbagi jatah permintaan dengan seluruh aplikasi, jadi polling rapat
 * menghabiskannya untuk user yang justru baru saja membayar. Yang sebenarnya menangkap pembayaran
 * bukan polling melainkan kembalinya user dari aplikasi bank, dan itu satu penyegaran. */
const POLL_MS = 15_000
const POLL_BUDGET = 40

const SECTION_LABEL: Record<StoreSection, string> = {
  boost: 'Biar dapat lebih banyak',
  cosmetic: 'Biar kelihatan',
}

const SECTION_ORDER: StoreSection[] = ['boost', 'cosmetic']

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
  const { store, busy, payment, order, buy, payWithCash, equip, refreshOrder, closeOrder } =
    useStore({ onBought })
  const showToast = useToast()

  /** Polling berhenti sendiri di tiga tempat: anggarannya habis, tagihannya lewat umur, atau
   * nasibnya sudah diketahui. Yang ketiga yang paling sering — dan ia juga yang mengucapkan
   * kalimat penutupnya, karena "lunas" dan "kedaluwarsa" sama-sama membuat layar ini tertutup
   * sementara cuma satu di antaranya kabar baik. */
  useEffect(() => {
    if (!order) return
    let spent = 0
    const timer = setInterval(() => {
      if (spent >= POLL_BUDGET || Date.now() >= order.expiresAt) {
        clearInterval(timer)
        return
      }
      spent += 1
      void refreshOrder()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [order, refreshOrder])

  const check = useCallback(async () => {
    const latest = await refreshOrder()
    if (!latest || latest.state === 'pending') return
    showToast(
      latest.state === 'paid'
        ? `${latest.itemTitle} udah masuk ke akun kamu.`
        : 'QR-nya udah lewat. Bikin lagi ya.',
      latest.state === 'paid' ? 'success' : 'error',
    )
  }, [refreshOrder, showToast])

  return (
    <>
      <div className="sheet-grip" aria-hidden="true" />

      <div className="flex shrink-0 items-center gap-3 px-content pt-3">
        <SheetIcon>
          <GlyphWallet className="size-4" />
        </SheetIcon>
        <div className="min-w-0 flex-1">
          <Dialog.Title className="truncate text-sm font-semibold tracking-tight text-foreground">
            {order ? 'Bayar pakai QRIS' : 'Toko TD'}
          </Dialog.Title>
          <Dialog.Description className="mt-0.5 truncate text-xs text-muted-foreground">
            {order
              ? order.itemTitle
              : store
                ? `Saldomu ${formatCredits(store.balance)} TD`
                : 'Lagi dibuka…'}
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
        {order ? (
          <QrisPanel
            qrisUrl={order.qrisUrl}
            orderId={order.orderId}
            amountIdr={order.amountIdr}
            totalAmountIdr={order.totalAmountIdr}
            expiresAt={order.expiresAt}
            priceLabel="Harga barang"
          />
        ) : !store ? (
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
          <Rack
            store={store}
            busy={busy}
            payment={payment}
            onBuy={(key) => void buy(key)}
            onPayCash={(key) => void payWithCash(key)}
            onEquip={(slot, key) => void equip(slot, key)}
          />
        )}
      </div>

      {order ? (
        <div className="sheet-foot">
          <PaymentFoot order={order} onBack={closeOrder} onCheck={check} />
        </div>
      ) : null}
    </>
  )
}

function PaymentFoot({
  order,
  onBack,
  onCheck,
}: {
  order: StoreOrder
  onBack: () => void
  onCheck: () => Promise<void>
}) {
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      await onCheck()
    } finally {
      setChecking(false)
    }
  }, [onCheck])

  return (
    <div className="flex gap-2">
      <ActionButton variant="ghost" className="flex-1" onClick={onBack}>
        Balik ke rak
      </ActionButton>
      <ActionButton className="flex-1" onClick={() => void check()} disabled={checking}>
        {checking ? 'Mengecek…' : 'Sudah bayar'}
      </ActionButton>
      <span className="sr-only">Kode pesanan {order.orderId}</span>
    </div>
  )
}

/** Rak dibagi dua bagian bertajuk, bukan satu daftar panjang. Sebelas barang berurutan tanpa
 * pemisah membuat bingkai dan gelar terbaca sebagai barang yang gagal berguna; dengan tajuknya
 * sendiri, keduanya jelas menjawab pertanyaan yang berbeda. */
function Rack({
  store,
  busy,
  payment,
  onBuy,
  onPayCash,
  onEquip,
}: {
  store: StoreSnapshot
  busy: string | null
  payment: 'credits' | 'cash'
  onBuy: (key: StoreItem['key']) => void
  onPayCash: (key: StoreItem['key']) => void
  onEquip: (slot: 'frame' | 'title', key: CosmeticKey | null) => void
}) {
  return (
    <>
      {store.gaspolUntil ? <GaspolNote until={store.gaspolUntil} /> : null}

      {SECTION_ORDER.map((section, index) => {
        const items = store.items.filter((item) => item.section === section)
        if (items.length === 0) return null

        return (
          <section key={section} className={cn(index > 0 && 'region-gap-t')}>
            <SectionLabel as="h3">{SECTION_LABEL[section]}</SectionLabel>
            <ul className="stack-gap-t flex flex-col gap-3">
              {items.map((item) => (
                <StoreRow
                  key={item.key}
                  item={item}
                  store={store}
                  busy={busy === item.key}
                  payment={payment}
                  onBuy={() => onBuy(item.key)}
                  onPayCash={() => onPayCash(item.key)}
                  onEquip={onEquip}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}

/** Sisa Pass Gaspol berdiri di atas rak, bukan di dalam baris barangnya. Yang sudah dibayar harus
 * terlihat sedang bekerja begitu lembarnya dibuka — kalau ia cuma jadi keterangan kecil di baris
 * pembelian, user yang membuka toko untuk memperpanjang tidak akan tahu sisanya berapa. */
function GaspolNote({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(timer)
  }, [])

  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1_000))
  if (secondsLeft === 0) return null

  return (
    <Surface className="block-gap-b flex items-center gap-2.5">
      <span className="stamp-portrait shrink-0">
        <GlyphPlay className="stamp-ink-fg size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold tracking-tight text-foreground">Gaspol lagi jalan</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Soal nggak motong energi sampai {formatLongCountdown(secondsLeft)} lagi.
        </p>
      </div>
    </Surface>
  )
}

function itemGlyph(item: StoreItem) {
  if (item.effect.kind === 'energy') return <GlyphBolt className="stamp-ink-fg size-4" />
  if (item.effect.kind === 'gaspol') return <GlyphPlay className="stamp-ink-fg size-4" />
  if (item.effect.kind === 'withdraw_skip') return <GlyphWithdraw className="stamp-ink-fg size-4" />
  if (item.effect.kind === 'premium') return <GlyphCrown className="stamp-ink-fg size-4" />
  return cosmetic(item.effect.cosmetic).kind === 'frame' ? (
    <GlyphUser className="stamp-ink-fg size-4" />
  ) : (
    <GlyphTrophy className="stamp-ink-fg size-4" />
  )
}

function StoreRow({
  item,
  store,
  busy,
  payment,
  onBuy,
  onPayCash,
  onEquip,
}: {
  item: StoreItem
  store: StoreSnapshot
  busy: boolean
  payment: 'credits' | 'cash'
  onBuy: () => void
  onPayCash: () => void
  onEquip: (slot: 'frame' | 'title', key: CosmeticKey | null) => void
}) {
  const owned =
    item.effect.kind === 'cosmetic' && store.owned.includes(item.effect.cosmetic)
      ? item.effect.cosmetic
      : null

  return (
    <li>
      <Surface>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className="stamp-portrait shrink-0">{itemGlyph(item)}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-foreground">{item.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground text-pretty">
                {item.detail}
              </p>
            </div>
          </div>
          {owned ? (
            <MetaBadge tone="success">Punya</MetaBadge>
          ) : item.priceCredits !== null ? (
            <CreditAmount value={formatCredits(item.priceCredits)} className="shrink-0" />
          ) : item.priceIdr !== null ? (
            <MetaBadge tone="primary">{formatRupiah(item.priceIdr)}</MetaBadge>
          ) : null}
        </div>

        {owned ? (
          <EquipRow cosmeticKey={owned} store={store} onEquip={onEquip} />
        ) : (
          <BuyRow
            item={item}
            store={store}
            busy={busy}
            payment={payment}
            onBuy={onBuy}
            onPayCash={onPayCash}
          />
        )}
      </Surface>
    </li>
  )
}

/** Dua tombol berdampingan saat barangnya punya dua harga, satu tombol saat cuma punya satu.
 *
 * Yang di kiri selalu TD dan yang di kanan selalu Rupiah, apa pun barangnya — posisi yang berpindah
 * antar baris membuat orang menekan tombol yang salah pada rak sepanjang ini. Nominalnya dicetak di
 * dalam tombol, bukan cuma di chip harga di atas: yang ditekan harus menyatakan sendiri berapa yang
 * keluar dan dari kantong mana. */
function BuyRow({
  item,
  store,
  busy,
  payment,
  onBuy,
  onPayCash,
}: {
  item: StoreItem
  store: StoreSnapshot
  busy: boolean
  payment: 'credits' | 'cash'
  onBuy: () => void
  onPayCash: () => void
}) {
  const creditBlocker = item.priceCredits === null ? null : itemBlocker(item, store, 'credits')
  const cashBlocker = item.priceIdr === null ? null : itemBlocker(item, store, 'cash')

  return (
    <div className="mt-3 flex gap-2 [&>*]:min-w-0 [&>*]:flex-1">
      {item.priceCredits === null ? null : (
        <ActionButton
          className={cn(creditBlocker && 'opacity-60')}
          onClick={onBuy}
          disabled={busy || creditBlocker !== null}
          aria-busy={busy && payment === 'credits'}
        >
          {busy && payment === 'credits' ? (
            <GlyphSpinner className="size-4 animate-spin motion-reduce:animate-none" />
          ) : null}
          {creditBlocker ?? `Tukar ${formatCredits(item.priceCredits)} TD`}
        </ActionButton>
      )}

      {item.priceIdr === null ? null : (
        <ActionButton
          variant="ghost"
          className={cn(cashBlocker && 'opacity-60')}
          onClick={onPayCash}
          disabled={busy || cashBlocker !== null}
          aria-busy={busy && payment === 'cash'}
        >
          {busy && payment === 'cash' ? (
            <GlyphSpinner className="size-4 animate-spin motion-reduce:animate-none" />
          ) : null}
          {cashBlocker ?? `Bayar ${formatRupiah(item.priceIdr)}`}
        </ActionButton>
      )}
    </div>
  )
}

/** Kosmetik yang sudah dimiliki berhenti punya tombol beli dan berganti jadi tombol pakai. Kalimat
 * "Udah punya" pada tombol yang mati adalah jalan buntu: barangnya ada, dan yang dicari user
 * berikutnya justru cara memakainya. */
function EquipRow({
  cosmeticKey,
  store,
  onEquip,
}: {
  cosmeticKey: CosmeticKey
  store: StoreSnapshot
  onEquip: (slot: 'frame' | 'title', key: CosmeticKey | null) => void
}) {
  const slot = cosmetic(cosmeticKey).kind
  const wearing = (slot === 'frame' ? store.equipped.frame : store.equipped.title) === cosmeticKey

  return (
    <ActionButton
      variant={wearing ? 'ghost' : 'primary'}
      className="mt-3"
      onClick={() => onEquip(slot, wearing ? null : cosmeticKey)}
    >
      {wearing ? (
        <>
          <GlyphCheck className="size-4" />
          Lagi dipakai · lepas
        </>
      ) : (
        'Pakai sekarang'
      )}
    </ActionButton>
  )
}
