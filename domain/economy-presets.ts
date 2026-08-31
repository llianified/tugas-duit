import {
  DEFAULT_ECONOMY_CONFIG,
  ECONOMY_FIELDS,
  type EconomyConfig,
  type EconomyConfigKey,
} from '@/domain/economy-config'

export interface EconomyPreset {
  id: string
  label: string
  summary: string
  values: Partial<EconomyConfig>
}

const KEYS = new Set<string>(ECONOMY_FIELDS.map((field) => field.key))

export const ECONOMY_PRESETS: readonly EconomyPreset[] = [
  {
    id: 'defaults',
    label: 'Nilai bawaan kode',
    summary: 'Kembalikan seluruh setelan ke DEFAULT_ECONOMY_CONFIG yang ada di repo.',
    values: DEFAULT_ECONOMY_CONFIG,
  },
]

export type EconomyPatch = Partial<Record<EconomyConfigKey, number>>

export type EconomyPatchResult =
  | { ok: true; patch: EconomyPatch; unknownKeys: string[] }
  | { ok: false; message: string }

/** Menerima JSON penuh maupun sebagian, termasuk hasil "Salin config" yang dibungkus { config: … }. */
export function parseEconomyPatch(text: string): EconomyPatchResult {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: false, message: 'Tempel dulu JSON konfigurasinya.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, message: 'JSON tidak bisa dibaca. Pastikan tersalin utuh, termasuk kurung kurawalnya.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, message: 'Isinya harus objek JSON, bukan angka atau daftar.' }
  }

  const record = parsed as Record<string, unknown>
  const source =
    record.config && typeof record.config === 'object' && !Array.isArray(record.config)
      ? (record.config as Record<string, unknown>)
      : record

  const patch: EconomyPatch = {}
  const unknownKeys: string[] = []
  const badKeys: string[] = []

  for (const [key, value] of Object.entries(source)) {
    if (!KEYS.has(key)) {
      unknownKeys.push(key)
      continue
    }
    const numeric = typeof value === 'string' ? Number(value.trim()) : value
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
      badKeys.push(key)
      continue
    }
    patch[key as EconomyConfigKey] = numeric
  }

  if (badKeys.length > 0) {
    return { ok: false, message: `Nilai bukan angka pada: ${badKeys.slice(0, 4).join(', ')}.` }
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: 'Tidak ada satu pun key setelan yang dikenali di JSON itu.' }
  }

  return { ok: true, patch, unknownKeys }
}
