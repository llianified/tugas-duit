'use client'

import { useEffect, useRef, useState } from 'react'
import { ActionButton } from '@/shared/components/action-button'
import {
  DataList,
  DataListAmount,
  DataListMarker,
  DataListRow,
} from '@/shared/components/data-list'
import { EmptyState } from '@/shared/components/empty-state'
import { GlyphCheck, GlyphCopy, GlyphShare, GlyphUsers } from '@/shared/components/glyph'
import { IconCircle } from '@/shared/components/icon-circle'
import { PageHeader } from '@/shared/components/page-header'
import { PageRegion } from '@/shared/components/page-region'
import { SectionLabel } from '@/shared/components/section-label'
import { Surface } from '@/shared/components/surface'
import { TotalSummary } from '@/shared/components/total-summary'
import { VIEW_TITLE } from '@/navigation/app-view'
import { buildShareCaption } from '@/features/referral/share-caption'
import { shareLink } from '@/shell/share'
import { formatCredits, formatCreditsPrecise, formatHistoryTime } from '@/shared/lib/format'
import {
  referralCommissionPercent,
  unitsToCredits,
  type Referral,
  type ReferralSummary,
} from '@/features/referral/domain'

export function ReferralView({
  referrals,
  summary,
  code,
  shareUrl,
  earnedCredits,
}: {
  referrals: Referral[]
  summary: ReferralSummary
  code: string
  shareUrl: string
  earnedCredits: number
}) {
  return (
    <div className="view-min-h flex flex-col">
      <PageHeader title={VIEW_TITLE.referral} />

      <div className="region-under-brand">
        <CommissionSummary
          summary={summary}
          hasReferrals={referrals.length > 0}
          hasEarningReferrals={referrals.some((referral) => referral.commissionUnits > 0)}
        />
      </div>

      <PageRegion>
        <InviteCard
          code={code}
          shareUrl={shareUrl}
          earnedCredits={earnedCredits}
          friends={referrals.length}
        />
      </PageRegion>

      <PageRegion>
        <RuleNote />
      </PageRegion>

      <PageRegion>
        {referrals.length > 0 ? (
          <ReferralList referrals={referrals} />
        ) : (
          <EmptyState
            icon={<GlyphUsers className="glyph-md text-muted-foreground" />}
            title="Belum ada teman gabung"
            description="Teman yang daftar pakai kode undangan kamu bakal muncul di sini."
          />
        )}
      </PageRegion>

      <div
        className={
          referrals.length > 0 ? 'view-trim-b flex-1 [--view-trim-b:var(--list-row-py)]' : 'flex-1'
        }
      />
    </div>
  )
}

/** `summary` datang dari `referral_wallets` + ledger, sedangkan daftar di bawahnya menjumlahkan `referral_commissions` per downline. Keduanya bisa tidak nol bersamaan: komisi yang belum genap 1 credit hidup sebagai unit di dompet, dan komisi yang hangus kena plafon harian (lihat `docs/keputusan-desain.md`) tetap tercatat di barisnya. Karena itu "belum ada komisi" hanya boleh muncul kalau ketiganya nol — kalau tidak, layarnya menyatakan teman belum mengerjakan apa pun tepat di atas daftar yang menunjukkan mereka sudah. */
function CommissionSummary({
  summary,
  hasReferrals,
  hasEarningReferrals,
}: {
  summary: ReferralSummary
  hasReferrals: boolean
  hasEarningReferrals: boolean
}) {
  if (summary.credits === 0 && summary.pendingUnits === 0 && !hasEarningReferrals) {
    return <CommissionEmpty hasReferrals={hasReferrals} />
  }

  const note =
    summary.pendingUnits > 0
      ? `${formatCredits(summary.pendingUnits)}/100 unit terkumpul menuju 1 credit berikutnya.`
      : undefined

  return (
    <TotalSummary
      label="Total komisi referral"
      credits={summary.credits}
      hint="Semua komisi dari task yang dikerjain teman-teman undangan kamu, sejak awal. Komisinya langsung masuk saldo begitu genap 1 credit."
      note={note}
    />
  )
}

function CommissionEmpty({ hasReferrals }: { hasReferrals: boolean }) {
  return (
    <section aria-label="Total komisi referral">
      <p className="text-base font-semibold tracking-tight">Belum ada komisi</p>
      <p className="stack-gap-t text-sm leading-relaxed text-muted-foreground text-pretty">
        {hasReferrals
          ? 'Teman kamu belum ngerjain task. Komisinya masuk saldo otomatis begitu mereka mulai.'
          : 'Bagi kode undangan di bawah. Komisi dari task teman kamu masuk saldo otomatis.'}
      </p>
    </section>
  )
}

const COPIED_FEEDBACK_MS = 1_800

function InviteCard({
  code,
  shareUrl,
  earnedCredits,
  friends,
}: {
  code: string
  shareUrl: string
  earnedCredits: number
  friends: number
}) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    }
  }, [])

  /** Tombol utamanya berbagi, bukan menyalin. Menyalin menaruh tautan di papan klip lalu menyerahkan sisanya ke user — satu langkah lagi yang sebagian besar orang tidak lakukan. Lembar berbagi sistem membuka daftar aplikasi tujuannya langsung, dan itu satu-satunya jalan tautan ini keluar dari Telegram ke tempat teman-temannya berada. */
  async function handleShare() {
    if (!shareUrl) return
    setSharing(true)
    try {
      const outcome = await shareLink({
        url: shareUrl,
        text: buildShareCaption({ earnedCredits, friends }),
        title: 'Tugas Duit',
      })
      if (outcome === 'copied') markCopied()
    } finally {
      setSharing(false)
    }
  }

  function markCopied() {
    setCopied(true)
    if (resetTimer.current) clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  async function handleCopy() {
    const link = shareUrl || code

    try {
      await navigator.clipboard.writeText(link)
    } catch {
      return
    }

    markCopied()
  }

  return (
    <Surface as="section" aria-label="Kode undangan">
      <div className="flex gap-1" aria-hidden="true">
        {code.split('').map((character, index) => (
          <span
            key={index}
            className="flex aspect-square min-w-0 flex-1 items-center justify-center rounded-md bg-card text-base font-semibold tabular-nums"
          >
            {character}
          </span>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {copied ? 'Link undangan udah disalin.' : `Kode undangan kamu: ${code}`}
      </p>

      <ActionButton onClick={handleShare} disabled={sharing} className="cta-gap">
        <GlyphShare className="size-4" />
        Bagikan ke teman
      </ActionButton>

      <ActionButton variant="ghost" onClick={handleCopy} className="label-gap-t">
        {copied ? (
          <>
            <GlyphCheck className="size-4" />
            Tersalin
          </>
        ) : (
          <>
            <GlyphCopy className="size-4" />
            Salin tautan undangan
          </>
        )}
      </ActionButton>
    </Surface>
  )
}

function RuleNote() {
  const percent = formatCredits(referralCommissionPercent())

  return (
    <section aria-label="Cara program referral bekerja">
      <SectionLabel as="h2">Cara kerjanya</SectionLabel>

      <ol className="label-gap-t flex flex-col gap-2">
        <RuleStep step={1}>Bagi kode undangan kamu ke teman.</RuleStep>
        <RuleStep step={2}>Teman daftar pakai kode itu, terus ngerjain task.</RuleStep>
        <RuleStep step={3}>
          Kamu dapat <span className="font-medium text-foreground">{percent}%</span> dari setiap
          reward task mereka.
        </RuleStep>
      </ol>
    </section>
  )
}

function RuleStep({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <IconCircle size="xs" tone="muted" className="mt-0.5 font-medium tabular-nums">
        {step}
      </IconCircle>
      <span className="text-sm leading-relaxed text-muted-foreground text-pretty">{children}</span>
    </li>
  )
}

function ReferralList({ referrals }: { referrals: Referral[] }) {
  const sorted = [...referrals].sort((a, b) => b.joinedAt - a.joinedAt)

  const activeCount = referrals.filter((referral) => referral.lastTaskAt !== null).length

  return (
    <DataList
      label="Teman kamu"
      badge={`${activeCount} dari ${referrals.length} aktif`}
      ariaLabel="Teman yang diundang"
    >
      {sorted.map((referral, index) => (
        <ReferralListItem
          key={referral.id}
          referral={referral}
          showDivider={index !== sorted.length - 1}
        />
      ))}
    </DataList>
  )
}

function ReferralListItem({
  referral,
  showDivider,
}: {
  referral: Referral
  showDivider: boolean
}) {
  const credits = unitsToCredits(referral.commissionUnits)
  const lastTaskAt = referral.lastTaskAt
  const isActive = lastTaskAt !== null

  return (
    <DataListRow
      showDivider={showDivider}
      marker={
        <DataListMarker tone={isActive ? 'primary' : 'muted'}>
          {referral.name.charAt(0)}
        </DataListMarker>
      }
      title={referral.name}
      meta={
        isActive
          ? `${referral.tasksCompleted} task · ${formatHistoryTime(lastTaskAt)}`
          : 'Belum mulai mengerjakan task'
      }
      amount={
        isActive ? <DataListAmount value={`+${formatCreditsPrecise(credits)}`} /> : undefined
      }
    />
  )
}
