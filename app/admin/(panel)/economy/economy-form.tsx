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
      <div className="admin-head">
        <h1 className="admin-head-title">Ekonomi</h1>
        <span className="chip chip-muted">Versi {saved.version}</span>
      </div>

      <p className="admin-sub">
        Perubahan aktif setelah Terapkan ditekan. Terakhir diperbarui {formatDateTime(saved.updatedAt)}.
      </p>

      {notice ? (
        <p role="status" className="admin-note" data-tone={Object.keys(errors).length > 0 ? 'danger' : 'success'}>
          {notice}
        </p>
      ) : null}
      {errors._ ? (
        <p role="alert" className="admin-note" data-tone="danger">
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
                <span aria-label={`${count} perubahan belum diterapkan`} className="admin-tab-count">
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
        className="focus-ring flex flex-col gap-2.5"
      >
        <div>
          <h2 className="admin-eyebrow text-foreground">
            {GROUP_LABEL[group]} · {visibleFields.length} setelan
            {visibleChanges > 0 ? ` · ${visibleChanges} diubah` : ''}
          </h2>
          <p className="admin-sub">{GROUP_DESCRIPTION[group]}</p>
        </div>

        <ul className="flex flex-col gap-2.5">
          {visibleFields.map((field) => {
            const changed = changedKeys.has(field.key)
            const invalid = Boolean(errors[field.key])
            const binary = BINARY_FIELDS.has(field.key)
            const checked = draft[field.key] === '1'

            return (
              <li
                key={field.key}
                className={cn(
                  'admin-card',
                  changed && 'ring-1 ring-primary',
                  invalid && 'ring-1 ring-destructive',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`economy-${field.key}`} className="admin-row-title">
                      {field.label}
                    </label>
                    <p className="admin-sub">{field.description}</p>
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
                      <span className={cn('text-xs font-bold', checked ? 'text-primary' : 'text-muted-foreground')}>
                        {checked ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-col items-end gap-1">
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
                        className="focus-ring admin-input admin-input-num"
                      />
                      <span id={`economy-${field.key}-meta`} className="admin-stat-h text-right">
                        {field.unit} · {field.min}–{field.max}
                      </span>
                    </div>
                  )}
                </div>

                <p id={`economy-${field.key}-impact`} className="admin-sub border-t border-border pt-2.5">
                  <span className="font-bold text-foreground">Dampak: </span>
                  {field.impact}
                </p>

                {changed ? (
                  <p className="text-xs font-bold text-primary">
                    Sebelumnya {formatValue({ field, value: saved.config[field.key] })}
                  </p>
                ) : null}
                {invalid ? (
                  <p role="alert" className="text-xs font-bold text-destructive">
                    {errors[field.key]}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {changes.length > 0 ? (
        <>
          <div aria-hidden="true" className="h-14" />
          <div className="admin-savebar">
            <div className="admin-savebar-row">
              <button
                type="button"
                disabled={pending}
                onClick={resetDraft}
                className="focus-ring transition-ui admin-btn admin-btn-ghost admin-btn-sm"
              >
                Batalkan
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onSubmit}
                className="focus-ring transition-ui admin-btn admin-btn-primary admin-btn-sm admin-btn-grow"
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
    <div className="admin-page">
      <div className="admin-head">
        <h1 className="admin-head-title">Perlu konfirmasi</h1>
        <span className="chip chip-destructive">{risky.length} berisiko</span>
      </div>

      <p className="admin-note" data-tone="danger">
        {risky.length} dari {changes.length} perubahan berpotensi menambah pembayaran ke pengguna. Periksa nilainya
        sebelum melanjutkan.
      </p>

      <ul className="admin-card admin-list">
        {changes.map(({ field, before, after }) => {
          const isRisky = risky.some((entry) => entry.field.key === field.key)
          return (
            <li key={field.key} className="admin-row">
              <div className="admin-row-main">
                <span className="admin-row-title">{field.label}</span>
                {isRisky ? <span className="text-xs leading-relaxed text-destructive">{field.impact}</span> : null}
              </div>
              <span className="admin-row-value">
                <span className="font-normal text-muted-foreground">{formatValue({ field, value: before })} </span>
                <span aria-hidden="true">→</span> {formatValue({ field, value: after })}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="admin-actions">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="focus-ring transition-ui admin-btn admin-btn-quiet"
        >
          Kembali
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="focus-ring transition-ui admin-btn admin-btn-primary admin-btn-grow"
        >
          {pending ? 'Menyimpan…' : 'Konfirmasi dan terapkan'}
        </button>
      </div>
    </div>
  )
}
