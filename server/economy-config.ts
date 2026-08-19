import type { PoolClient } from 'pg'
import {
  type EconomyConfig,
  type EconomyConfigKey,
  type EconomyValidationErrors,
  ECONOMY_FIELDS,
  setActiveEconomyConfig,
  validateEconomyConfig,
} from '@/domain/economy-config'
import { query, transaction } from './db'
import { env } from './env'
import { requireAdmin } from './session'

const CACHE_TTL_MS = 30_000

let cached: { config: EconomyConfig; version: number; at: number } | null = null

interface StoredRow {
  config: unknown
  version: number
  updated_at: Date
  updated_by: string | null
}

export class EconomyConfigError extends Error {
  code: string
  status: number
  errors?: EconomyValidationErrors

  constructor(code: string, status: number, errors?: EconomyValidationErrors) {
    super(code)
    this.name = 'EconomyConfigError'
    this.code = code
    this.status = status
    this.errors = errors
  }
}

function parseRow(row: StoredRow | undefined): { config: EconomyConfig; version: number } {
  if (!row) {
    throw new EconomyConfigError('ECONOMY_CONFIG_MISSING', 500)
  }
  const parsed = validateEconomyConfig(row.config)
  if (!parsed.ok) {
    console.error('[economy-config] baris konfigurasi tidak lolos validasi:', parsed.errors)
    throw new EconomyConfigError('ECONOMY_CONFIG_INVALID', 500, parsed.errors)
  }
  return { config: parsed.config, version: row.version }
}

export async function loadEconomyConfig(): Promise<EconomyConfig> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    setActiveEconomyConfig(cached.config)
    return cached.config
  }
  const rows = await query<StoredRow>(
    'select config, version, updated_at, updated_by from economy_config where id=1',
  )
  const { config, version } = parseRow(rows[0])
  cached = { config, version, at: Date.now() }
  setActiveEconomyConfig(config)
  return config
}

export function invalidateEconomyConfigCache(): void {
  cached = null
}

export interface EconomyConfigSnapshot {
  config: EconomyConfig
  version: number
  updatedAt: number
  updatedBy: string | null
}

export async function readEconomyConfigSnapshot(): Promise<EconomyConfigSnapshot> {
  await requireAdmin()
  const rows = await query<StoredRow>(
    'select config, version, updated_at, updated_by from economy_config where id=1',
  )
  const row = rows[0]
  const { config, version } = parseRow(row)
  return {
    config,
    version,
    updatedAt: row.updated_at.getTime(),
    updatedBy: row.updated_by,
  }
}

export interface EconomyConfigChange {
  field: EconomyConfigKey
  oldValue: number
  newValue: number
}

export async function updateEconomyConfig(
  adminId: number,
  input: unknown,
  expectedVersion: number,
): Promise<{ snapshot: EconomyConfigSnapshot; changes: EconomyConfigChange[] }> {
  const parsed = validateEconomyConfig(input)
  if (!parsed.ok) {
    throw new EconomyConfigError('ECONOMY_CONFIG_INVALID', 400, parsed.errors)
  }
  const next = parsed.config

  const result = await transaction(async (tx: PoolClient) => {
    const current = await tx.query<StoredRow>(
      'select config, version, updated_at, updated_by from economy_config where id=1 for update',
    )
    const actor = await tx.query<{ is_admin: boolean; telegram_id: string; banned_at: Date | null }>(
      'select is_admin, telegram_id, banned_at from users where id=$1',
      [adminId],
    )
    const row0 = actor.rows[0]
    const configuredAdmin = env.adminTelegramIdOrNull
    const isAdmin = Boolean(row0) && !row0.banned_at &&
      (row0.is_admin || (configuredAdmin !== null && row0.telegram_id === configuredAdmin))
    if (!isAdmin) throw new EconomyConfigError('ECONOMY_CONFIG_FORBIDDEN', 403)

    const { config: previous, version } = parseRow(current.rows[0])
    if (version !== expectedVersion) {
      throw new EconomyConfigError('ECONOMY_CONFIG_CONFLICT', 409)
    }

    const changes: EconomyConfigChange[] = []
    for (const field of ECONOMY_FIELDS) {
      if (previous[field.key] !== next[field.key]) {
        changes.push({ field: field.key, oldValue: previous[field.key], newValue: next[field.key] })
      }
    }

    const updated = await tx.query<StoredRow>(
      `update economy_config
          set config=$1::jsonb, version=version+1, updated_at=now(), updated_by=$2
        where id=1 and version=$3
        returning config, version, updated_at, updated_by`,
      [JSON.stringify(next), adminId, expectedVersion],
    )
    const row = updated.rows[0]
    if (!row) throw new EconomyConfigError('ECONOMY_CONFIG_CONFLICT', 409)

    for (const change of changes) {
      await tx.query(
        `insert into economy_config_audit(changed_by, field, old_value, new_value, version)
         values($1,$2,$3,$4,$5)`,
        [adminId, change.field, String(change.oldValue), String(change.newValue), row.version],
      )
    }

    return {
      snapshot: {
        config: next,
        version: row.version,
        updatedAt: row.updated_at.getTime(),
        updatedBy: row.updated_by,
      },
      changes,
    }
  })

  invalidateEconomyConfigCache()
  setActiveEconomyConfig(result.snapshot.config)
  cached = { config: result.snapshot.config, version: result.snapshot.version, at: Date.now() }
  return result
}

export interface EconomyAuditEntry {
  field: string
  oldValue: string
  newValue: string
  version: number
  changedAt: number
  changedBy: string | null
}

export async function readEconomyAudit(limit = 50): Promise<EconomyAuditEntry[]> {
  await requireAdmin()
  const rows = await query<{
    field: string
    old_value: string
    new_value: string
    version: number
    changed_at: Date
    first_name: string | null
  }>(
    `select a.field, a.old_value, a.new_value, a.version, a.changed_at, u.first_name
       from economy_config_audit a
       left join users u on u.id = a.changed_by
      order by a.changed_at desc, a.id desc
      limit $1`,
    [Math.min(200, Math.max(1, limit))],
  )
  return rows.map((row) => ({
    field: row.field,
    oldValue: row.old_value,
    newValue: row.new_value,
    version: row.version,
    changedAt: row.changed_at.getTime(),
    changedBy: row.first_name,
  }))
}
