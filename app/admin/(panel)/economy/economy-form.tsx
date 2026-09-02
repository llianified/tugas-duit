'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import { formatDateTime } from '@/shared/lib/format'
import { cn } from '@/shared/lib/utils'
import {
  ECONOMY_FIELDS,
  validateEconomyConfig,
  type EconomyConfig,
  type EconomyConfigKey,
  type EconomyGroup,
  type EconomyValidationErrors,
} from '@/domain/economy/economy-config'
import {
  ECONOMY_PRESETS,
  parseEconomyPatch,
  type EconomyPatch,
} from '@/domain/economy/economy-presets'
import type { EconomyAuditEntry, EconomyConfigSnapshot } from '@/server/economy/economy-config'

const GROUP_LABEL: Record<EconomyGroup, string> = {
  earnings: 'Plafon',
  reward: 'Reward',
  task: 'Soal',
  difficulty: 'Kesulitan',
  energy: 'Energi',
  ads: 'Iklan',
  withdrawal: 'Penarikan',
  referral: 'Referral',
  progression: 'Rank',
  channel: 'Channel',
  premium: 'Premium',
  mission: 'Misi',
  feature: 'Fitur',
}

const GROUP_ORDER: EconomyGroup[] = [
  'earnings',
  'reward',
  'task',
  'difficulty',
  'energy',
  'ads',
  'withdrawal',
  'referral',
  'progression',
  'channel',
  'premium',
  'mission',
  'feature',
]

type Draft = Record<EconomyConfigKey, string>

const toDraft = (config: EconomyConfig): Draft =>
  Object.fromEntries(ECONOMY_FIELDS.map((f) => [f.key, String(config[f.key])])) as Draft

const toNumbers = (draft: Draft): Record<string, unknown> =>
  Object.fromEntries(
    ECONOMY_FIELDS.map((f) => [f.key, draft[f.key].trim() === '' ? NaN : Number(draft[f.key])]),
  )

export function EconomyForm({
  snapshot,
  audit,
}: {
  snapshot: EconomyConfigSnapshot
  audit: EconomyAuditEntry[]
}) {
  const [saved, setSaved] = useState(snapshot)
  const [draft, setDraft] = useState<Draft>(() => toDraft(snapshot.config))
  const [errors, setErrors] = useState<EconomyValidationErrors>({})
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [group, setGroup] = useState<EconomyGroup>('earnings')
  const [helpFor, setHelpFor] = useState<EconomyConfigKey | null>(null)

  const changes = useMemo(
    () =>
      ECONOMY_FIELDS.filter((f) => draft[f.key].trim() !== String(saved.config[f.key])).map((f) => ({
        field: f,
        before: saved.config[f.key],
        after: Number(draft[f.key]),
      })),
    [draft, saved],
  )

  const risky = changes.filter(({ field, before, after }) =>
    field.riskyWhen === 'higher'
      ? after > before
      : field.riskyWhen === 'lower'
        ? after < before
        : false,
  )

  /** Navigasi panah untuk tablist. Fokusnya dipindahkan ke tab tujuan karena hanya tab aktif yang punya `tabIndex=0`: tanpa ini, panah akan mengganti panel sambil meninggalkan fokus di elemen yang barusan keluar dari urutan Tab. */
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = GROUP_ORDER.indexOf(group)
    const last = GROUP_ORDER.length - 1
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % GROUP_ORDER.length
        : event.key === 'ArrowLeft'
          ? (index + last) % GROUP_ORDER.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null

    if (next === null) return
    event.preventDefault()
    const target = GROUP_ORDER[next]
    setGroup(target)
    document.getElementById(`economy-tab-${target}`)?.focus()
  }

  function applyPatch(patch: EconomyPatch, label: string, ignored: string[] = []) {
    const entries = Object.entries(patch) as [EconomyConfigKey, number][]
    setDraft((current) => {
      const next = { ...current }
      for (const [key, value] of entries) next[key] = String(value)
      return next
    })
    setErrors({})
    const differing = entries.filter(([key, value]) => value !== saved.config[key]).length
    setNotice(
      differing === 0
        ? `${label} sudah sama dengan konfigurasi aktif. Tidak ada yang perlu diterapkan.`
        : `${label} dimuat ke draf: ${differing} setelan berbeda dari yang aktif. Periksa lalu tekan Terapkan.` +
            (ignored.length > 0 ? ` Key tak dikenal diabaikan: ${ignored.slice(0, 5).join(', ')}.` : ''),
    )
  }

  function onSubmit() {
    const parsed = validateEconomyConfig(toNumbers(draft))
    if (!parsed.ok) {
      setErrors(parsed.errors)
      setNotice(null)
      return
    }
    setErrors({})
    if (risky.length > 0 && !confirming) {
      setConfirming(true)
      return
    }
    void save(parsed.config)
  }

  async function save(config: EconomyConfig) {
    setPending(true)
    setNotice(null)
    try {
      const response = await fetch('/api/admin/economy', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ config, version: saved.version }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { snapshot?: EconomyConfigSnapshot; error?: { message?: string; fields?: EconomyValidationErrors } }
        | null
      if (!response.ok || !payload?.snapshot) {
        setErrors(payload?.error?.fields ?? {})
        setNotice(payload?.error?.message ?? 'Gagal menyimpan konfigurasi.')
        return
      }
      setSaved(payload.snapshot)
      setDraft(toDraft(payload.snapshot.config))
      setNotice('Konfigurasi tersimpan. Berlaku seketika di server ini, paling lambat 30 detik di instance lain.')
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <ConfirmPanel
        changes={changes}
        risky={risky}
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          const parsed = validateEconomyConfig(toNumbers(draft))
          if (parsed.ok) void save(parsed.config)
        }}
      />
    )
  }

  const changedKeys = new Set(changes.map((change) => change.field.key))

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">Ekonomi</h2>
        <p className="text-xs text-muted-foreground">
          v{saved.version} · {formatDateTime(saved.updatedAt)}
        </p>
      </header>

      {notice ? (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-foreground">{notice}</p>
      ) : null}
      {errors._ ? (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-destructive">{errors._}</p>
      ) : null}

      <ConfigLoader current={saved.config} onApply={applyPatch} />

      {/* Pola tab yang utuh: tiap tab menunjuk panelnya (`aria-controls`), panelnya
          membawa `role="tabpanel"`, dan hanya tab aktif yang masuk urutan Tab —
          sisanya dijangkau panah kiri/kanan seperti yang diwajibkan pola ini. */}
      <div
        role="tablist"
        aria-label="Kelompok setelan"
        onKeyDown={onTabKeyDown}
        className="admin-tabs"
      >
        {GROUP_ORDER.map((entry) => {
          const pending = ECONOMY_FIELDS.filter(
            (f) => f.group === entry && changedKeys.has(f.key),
          ).length
          return (
            <button
              key={entry}
              type="button"
              role="tab"
              id={`economy-tab-${entry}`}
              aria-selected={entry === group}
              aria-controls="economy-panel"
              tabIndex={entry === group ? 0 : -1}
              onClick={() => setGroup(entry)}
              className="focus-ring transition-ui admin-tab"
            >
              {GROUP_LABEL[entry]}
              {pending > 0 ? (
                <span
                  aria-label={`${pending} belum diterapkan`}
                  className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground"
                >
                  {pending}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <ul
        role="tabpanel"
        id="economy-panel"
        aria-labelledby={`economy-tab-${group}`}
        tabIndex={0}
        className="focus-ring flex flex-col gap-2"
      >
        {ECONOMY_FIELDS.filter((f) => f.group === group).map((field) => {
          const changed = changedKeys.has(field.key)
          const invalid = Boolean(errors[field.key])
          const open = helpFor === field.key
          return (
            <li
              key={field.key}
              className={cn(
                'rounded-xl bg-muted',
                changed && 'ring-1 ring-primary/50',
                invalid && 'ring-1 ring-destructive',
              )}
            >
              <div className="flex items-center gap-2 p-2.5">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`economy-${field.key}`}
                    className="block text-sm font-medium leading-tight text-foreground"
                  >
                    {field.label}
                  </label>
                  <span id={`economy-${field.key}-meta`} className="text-[11px] text-muted-foreground">
                    {field.unit} · {field.min}–{field.max}
                    {changed ? ` · dari ${saved.config[field.key]}` : ''}
                  </span>
                </div>
                <input
                  id={`economy-${field.key}`}
                  inputMode="numeric"
                  value={draft[field.key]}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  aria-invalid={invalid}
                  aria-describedby={`economy-${field.key}-meta`}
                  className="focus-ring w-24 shrink-0 rounded-lg bg-background px-2 py-2 text-right text-sm tabular-nums text-foreground"
                />
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`economy-${field.key}-help`}
                  aria-label={`Penjelasan ${field.label}`}
                  onClick={() => setHelpFor(open ? null : field.key)}
                  className="focus-ring transition-ui size-8 shrink-0 rounded-full text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  ?
                </button>
              </div>

              {open ? (
                <p
                  id={`economy-${field.key}-help`}
                  className="border-t border-border px-2.5 py-2 text-xs leading-relaxed text-muted-foreground"
                >
                  {field.description}{' '}
                  <span className="text-foreground/70">{field.impact}</span>
                </p>
              ) : null}

              {invalid ? (
                <p className="border-t border-border px-2.5 py-2 text-xs font-medium text-destructive">
                  {errors[field.key]}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <AuditList entries={audit} />

      {changes.length > 0 ? (
        <>
          <div aria-hidden="true" className="h-14" />
          <div className="admin-savebar">
            <div className="admin-savebar-row">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setDraft(toDraft(saved.config))
                  setErrors({})
                }}
                className="focus-ring transition-ui rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onSubmit}
                className="focus-ring transition-ui flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
              >
                {pending ? 'Menyimpan…' : `Terapkan ${changes.length} perubahan`}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function ConfigLoader({
  current,
  onApply,
}: {
  current: EconomyConfig
  onApply: (patch: EconomyPatch, label: string, ignored?: string[]) => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const exported = useMemo(
    () =>
      JSON.stringify(
        Object.fromEntries(ECONOMY_FIELDS.map((f) => [f.key, current[f.key]])),
        null,
        2,
      ),
    [current],
  )

  function onLoad() {
    const parsed = parseEconomyPatch(text)
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    setError(null)
    onApply(parsed.patch, 'Config tempelan', parsed.unknownKeys)
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(exported)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      setError('Papan klip tidak bisa diakses. Salin manual dari kotak di bawah.')
    }
  }

  return (
    <details className="rounded-xl bg-muted">
      <summary className="focus-ring cursor-pointer list-none rounded-xl px-3 py-2.5 text-sm font-medium text-foreground">
        Muat config
        <span className="pl-1.5 text-xs font-normal text-muted-foreground">preset atau JSON</span>
      </summary>

      <div className="flex flex-col gap-2 px-2.5 pb-2.5">
        <ul className="flex flex-col gap-2">
          {ECONOMY_PRESETS.map((preset) => (
            <li key={preset.id} className="rounded-lg bg-background p-2.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight text-foreground">{preset.label}</p>
                  <p className="pt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {preset.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    onApply(preset.values as EconomyPatch, preset.label)
                  }}
                  className="focus-ring transition-ui shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Muat
                </button>
              </div>
            </li>
          ))}
        </ul>

        <label htmlFor="economy-import" className="pt-1 text-xs font-medium text-foreground">
          Tempel JSON config
        </label>
        <textarea
          id="economy-import"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={'{\n  "rewardPoolCapIdr": 10000,\n  "rewardPoolRegenMinutes": 6\n}'}
          aria-invalid={Boolean(error)}
          aria-describedby="economy-import-hint"
          className="focus-ring w-full rounded-lg bg-background px-2.5 py-2 font-mono text-xs text-foreground"
        />
        <p id="economy-import-hint" className="text-[11px] leading-relaxed text-muted-foreground">
          Boleh sebagian key saja. Key yang tidak dikenal diabaikan, dan tidak ada yang tersimpan
          sebelum kamu menekan Terapkan.
        </p>

        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLoad}
            className="focus-ring transition-ui flex-1 rounded-lg bg-primary px-2.5 py-2 text-xs font-semibold text-primary-foreground"
          >
            Muat ke draf
          </button>
          <button
            type="button"
            onClick={() => void onCopy()}
            className="focus-ring transition-ui rounded-lg bg-background px-2.5 py-2 text-xs font-medium text-foreground"
          >
            {copied ? 'Tersalin' : 'Salin config aktif'}
          </button>
        </div>
      </div>
    </details>
  )
}

function ConfirmPanel({
  changes,
  risky,
  pending,
  onCancel,
  onConfirm,
}: {
  changes: { field: (typeof ECONOMY_FIELDS)[number]; before: number; after: number }[]
  risky: { field: (typeof ECONOMY_FIELDS)[number] }[]
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 rounded-xl bg-muted p-3">
        <h2 className="text-sm font-semibold text-foreground">
          Perubahan ini bisa menaikkan uang yang keluar
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {risky.length} dari {changes.length} perubahan menambah pembayaran ke user. Periksa sekali
          lagi sebelum menerapkannya.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {changes.map(({ field, before, after }) => {
          const isRisky = risky.some((entry) => entry.field.key === field.key)
          return (
            <li key={field.key} className="rounded-xl bg-muted p-2.5">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                  {isRisky ? '⚠ ' : ''}
                  {field.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {before} → <span className="font-semibold text-foreground">{after}</span>
                </span>
              </div>
              {isRisky ? (
                <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{field.impact}</p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div aria-hidden="true" className="h-14" />
      <div className="admin-savebar">
        <div className="admin-savebar-row">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="focus-ring transition-ui rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground"
          >
            Kembali
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="focus-ring transition-ui flex-1 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
          >
            {pending ? 'Menyimpan…' : 'Ya, terapkan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AuditList({ entries }: { entries: EconomyAuditEntry[] }) {
  return (
    <details className="rounded-xl bg-muted">
      <summary className="focus-ring cursor-pointer list-none rounded-xl px-3 py-2.5 text-sm font-medium text-foreground">
        Riwayat perubahan
        <span className="pl-1.5 text-xs font-normal text-muted-foreground">
          {entries.length === 0 ? 'belum ada' : entries.length}
        </span>
      </summary>
      {entries.length === 0 ? null : (
        <ul className="flex flex-col gap-2 px-2.5 pb-2.5">
          {entries.map((entry, index) => (
            <li
              key={`${entry.version}-${entry.field}-${index}`}
              className="rounded-lg bg-background px-2.5 py-2 text-xs"
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {entry.field}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {entry.oldValue} → {entry.newValue}
                </span>
              </div>
              <p className="pt-0.5 text-[11px] text-muted-foreground">
                v{entry.version} · {entry.changedBy ?? 'admin dihapus'} ·{' '}
                {formatDateTime(entry.changedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
