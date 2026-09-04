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
import type { EconomyConfigSnapshot } from '@/server/economy/economy-config'

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
  arcade: 'Arena',
  feature: 'Fitur',
}

const GROUP_DESCRIPTION: Record<EconomyGroup, string> = {
  earnings: 'Nilai credit dan kapasitas penghasilan.',
  reward: 'Besaran hadiah berdasarkan tingkat kesulitan.',
  task: 'Batas dan aturan pengerjaan soal.',
  difficulty: 'Parameter pembentuk tingkat kesulitan.',
  energy: 'Kapasitas, biaya, dan kecepatan pemulihan.',
  ads: 'Tiket rewarded dan jadwal interstitial.',
  withdrawal: 'Syarat, batas, dan jeda penarikan.',
  referral: 'Komisi dan plafon jaringan referral.',
  progression: 'Ambang kenaikan rank pengguna.',
  channel: 'Bonus dan gerbang keanggotaan Telegram.',
  premium: 'Harga dan manfaat akun premium.',
  mission: 'Target dan hadiah misi harian maupun sosial.',
  arcade: 'Akses, biaya, dan peluang hadiah Arena.',
  feature: 'Sakelar fitur yang terlihat oleh pengguna.',
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
  'arcade',
  'feature',
]

const BINARY_FIELDS = new Set(
  ECONOMY_FIELDS.filter((field) => field.min === 0 && field.max === 1).map((field) => field.key),
)

type Draft = Record<EconomyConfigKey, string>
type Change = { field: (typeof ECONOMY_FIELDS)[number]; before: number; after: number }

const toDraft = (config: EconomyConfig): Draft =>
  Object.fromEntries(ECONOMY_FIELDS.map((field) => [field.key, String(config[field.key])])) as Draft

const toNumbers = (draft: Draft): Record<string, unknown> =>
  Object.fromEntries(
    ECONOMY_FIELDS.map((field) => [
      field.key,
      draft[field.key].trim() === '' ? Number.NaN : Number(draft[field.key]),
    ]),
  )

function formatValue(change: Pick<Change, 'field'> & { value: number }) {
  if (BINARY_FIELDS.has(change.field.key)) return change.value === 1 ? 'Aktif' : 'Nonaktif'
  return `${change.value} ${change.field.unit ?? ''}`.trim()
}

export function EconomyForm({ snapshot }: { snapshot: EconomyConfigSnapshot }) {
  const [saved, setSaved] = useState(snapshot)
  const [draft, setDraft] = useState<Draft>(() => toDraft(snapshot.config))
  const [errors, setErrors] = useState<EconomyValidationErrors>({})
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [group, setGroup] = useState<EconomyGroup>('earnings')

  const changes = useMemo(
    () =>
      ECONOMY_FIELDS.filter((field) => draft[field.key].trim() !== String(saved.config[field.key])).map(
        (field) => ({
          field,
          before: saved.config[field.key],
          after: Number(draft[field.key]),
        }),
      ),
    [draft, saved],
  )

  const risky = changes.filter(({ field, before, after }) =>
    field.riskyWhen === 'higher'
      ? after > before
      : field.riskyWhen === 'lower'
        ? after < before
        : false,
  )

  const changedKeys = new Set(changes.map((change) => change.field.key))
  const visibleFields = ECONOMY_FIELDS.filter((field) => field.group === group)
  const visibleChanges = visibleFields.filter((field) => changedKeys.has(field.key)).length

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

  function updateField(key: EconomyConfigKey, value: string) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, _: undefined }))
    setNotice(null)
  }

  function onSubmit() {
    const parsed = validateEconomyConfig(toNumbers(draft))
    if (!parsed.ok) {
      setErrors(parsed.errors)
      const firstInvalid = ECONOMY_FIELDS.find((field) => parsed.errors[field.key])
      if (firstInvalid) setGroup(firstInvalid.group)
      setNotice('Ada setelan yang perlu diperbaiki sebelum perubahan dapat diterapkan.')
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
      setNotice('Semua perubahan sudah aktif. Server lain akan mengikutinya paling lambat 30 detik.')
    } catch {
      setNotice('Jaringan bermasalah. Perubahan belum tersimpan, jadi draf tetap dipertahankan.')
    } finally {
      setPending(false)
      setConfirming(false)
    }
  }

  function resetDraft() {
    setDraft(toDraft(saved.config))
    setErrors({})
    setNotice(null)
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

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="admin-page-title">Pengaturan ekonomi</h1>
          <span className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
            Versi {saved.version}
          </span>
        </div>
        <p className="admin-page-description">
          Atur reward, batas, dan akses fitur. Perubahan baru aktif setelah tombol Terapkan ditekan.
        </p>
        <p className="text-xs text-muted-foreground">Terakhir diperbarui {formatDateTime(saved.updatedAt)}</p>
      </header>

      {notice ? (
        <p role="status" className={cn('admin-panel px-4 py-3 text-sm', Object.keys(errors).length > 0 ? 'text-destructive' : 'text-foreground')}>
          {notice}
        </p>
      ) : null}
      {errors._ ? (
        <p role="alert" className="admin-panel px-4 py-3 text-sm font-medium text-destructive">
          {errors._}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Kategori pengaturan ekonomi"
        onKeyDown={onTabKeyDown}
        className="admin-tabs"
      >
        {GROUP_ORDER.map((entry) => {
          const count = ECONOMY_FIELDS.filter(
            (field) => field.group === entry && changedKeys.has(field.key),
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
              {count > 0 ? (
                <span aria-label={`${count} perubahan belum diterapkan`} className="rounded bg-background/20 px-1.5 text-xs tabular-nums">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <section
        role="tabpanel"
        id="economy-panel"
        aria-labelledby={`economy-tab-${group}`}
        tabIndex={0}
        className="focus-ring flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">{GROUP_LABEL[group]}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{GROUP_DESCRIPTION[group]}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {visibleFields.length} setelan{visibleChanges > 0 ? ` · ${visibleChanges} diubah` : ''}
          </p>
        </div>

        <ul className="grid gap-3 xl:grid-cols-2">
          {visibleFields.map((field) => {
            const changed = changedKeys.has(field.key)
            const invalid = Boolean(errors[field.key])
            const binary = BINARY_FIELDS.has(field.key)
            const checked = draft[field.key] === '1'

            return (
              <li
                key={field.key}
                className={cn(
                  'admin-panel flex flex-col gap-3 p-4',
                  changed && 'ring-1 ring-primary',
                  invalid && 'ring-1 ring-destructive',
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`economy-${field.key}`} className="text-sm font-semibold text-foreground">
                      {field.label}
                    </label>
                    <p className="pt-1 text-xs leading-relaxed text-muted-foreground">{field.description}</p>
                  </div>

                  {binary ? (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        id={`economy-${field.key}`}
                        type="button"
                        role="switch"
                        aria-checked={checked}
                        aria-describedby={`economy-${field.key}-impact`}
                        data-checked={checked}
                        onClick={() => updateField(field.key, checked ? '0' : '1')}
                        className="focus-ring admin-switch"
                      >
                        <span className="admin-switch-thumb" />
                      </button>
                      <span className={cn('text-xs font-semibold', checked ? 'text-primary' : 'text-muted-foreground')}>
                        {checked ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex w-28 shrink-0 flex-col items-end gap-1.5">
                      <input
                        id={`economy-${field.key}`}
                        type="number"
                        inputMode="numeric"
                        min={field.min}
                        max={field.max}
                        step={1}
                        value={draft[field.key]}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        aria-invalid={invalid}
                        aria-describedby={`economy-${field.key}-meta economy-${field.key}-impact`}
                        className="focus-ring w-full rounded-lg border border-border bg-background px-3 py-2 text-right text-sm font-semibold tabular-nums text-foreground"
                      />
                      <span id={`economy-${field.key}-meta`} className="text-right text-xs text-muted-foreground">
                        {field.unit} · {field.min}–{field.max}
                      </span>
                    </div>
                  )}
                </div>

                <p id={`economy-${field.key}-impact`} className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Dampak: </span>
                  {field.impact}
                </p>

                {changed ? (
                  <p className="text-xs font-medium text-primary">
                    Sebelumnya {formatValue({ field, value: saved.config[field.key] })}
                  </p>
                ) : null}
                {invalid ? (
                  <p role="alert" className="text-xs font-medium text-destructive">{errors[field.key]}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {changes.length > 0 ? (
        <>
          <div aria-hidden="true" className="h-16" />
          <div className="admin-savebar">
            <div className="admin-savebar-row">
              <div className="hidden min-w-0 flex-1 px-2 sm:block">
                <p className="text-sm font-semibold text-foreground">{changes.length} perubahan</p>
                <p className="truncate text-xs text-muted-foreground">Belum diterapkan ke pengguna</p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={resetDraft}
                className="focus-ring transition-ui rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onSubmit}
                className="focus-ring transition-ui flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:bg-muted disabled:text-muted-foreground sm:flex-none"
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

function ConfirmPanel({
  changes,
  risky,
  pending,
  onCancel,
  onConfirm,
}: {
  changes: Change[]
  risky: Pick<Change, 'field'>[]
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="admin-page max-w-3xl">
      <header className="admin-page-header">
        <p className="text-xs font-bold uppercase tracking-wider text-destructive">Perlu konfirmasi</p>
        <h1 className="admin-page-title">Perubahan dapat menaikkan pengeluaran</h1>
        <p className="admin-page-description">
          {risky.length} dari {changes.length} perubahan berpotensi menambah pembayaran ke pengguna. Periksa nilai berikut sebelum melanjutkan.
        </p>
      </header>

      <ul className="admin-panel divide-y divide-border">
        {changes.map(({ field, before, after }) => {
          const isRisky = risky.some((entry) => entry.field.key === field.key)
          return (
            <li key={field.key} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{field.label}</p>
                {isRisky ? <p className="pt-1 text-xs leading-relaxed text-destructive">{field.impact}</p> : null}
              </div>
              <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {formatValue({ field, value: before })} <span aria-hidden="true">→</span>{' '}
                <span className="font-semibold text-foreground">{formatValue({ field, value: after })}</span>
              </p>
            </li>
          )
        })}
      </ul>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="focus-ring transition-ui rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Kembali periksa
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="focus-ring transition-ui rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? 'Menyimpan…' : 'Konfirmasi dan terapkan'}
        </button>
      </div>
    </div>
  )
}
