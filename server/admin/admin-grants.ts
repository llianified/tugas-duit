import type { PoolClient } from 'pg'
import { isPremiumActive } from '@/domain/economy/premium'
import { query, transaction } from '../platform/db'
import { grantEnergy } from '../economy/energy'
import { refillRewardPool } from '../economy/reward-pool'
import { requireAdmin } from '../auth/session'

/** Aksi admin yang mengubah keadaan akun tanpa menyentuh saldo. `admin-users.ts` mengurus identitas dan akses — nama, penangguhan, hak admin. Yang di sini mengurus hal yang punya nilai ekonomi: premium, energi, dan stok reward. Dipisah karena ketiganya menuntut hal yang sama dan berbeda dari yang di sana: alasan wajib, jejak audit di `admin_actions`, dan kehati-hatian terhadap invarian yang sama dengan jalur user biasa (`users_energy_range`, kapasitas kolam, penumpukan tanggal premium). Yang TIDAK ada di sini: koreksi saldo. Itu tetap di `ledger.ts`, karena satu-satunya jalan mengubah `balance_credits` adalah `appendLedger` — dan jejaknya sudah dijamin ledger yang append-only, bukan oleh tabel audit ini. */

export class AdminGrantError extends Error {
  code: string
  status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'AdminGrantError'
    this.code = code
    this.status = status
  }
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GRANT_REASON_MAX = 280

/** Batas kewarasan, bukan aturan ekonomi: keduanya menahan salah ketik, bukan menyetel apa pun. */
export const PREMIUM_GRANT_MAX_DAYS = 730
export const ENERGY_GRANT_MAX = 10
export const POOL_REFILL_MAX = 10_000

export type AdminActionKind =
  | 'premium_grant'
  | 'premium_revoke'
  | 'energy_grant'
  | 'pool_refill'
  | 'notifications_unmute'
  | 'notifications_mute'
  | 'channel_gate_reset'
  /** Jalur identitas dan akses (`admin-users.ts`). Ledger mencatat uang dan `economy_config_audit` mencatat besaran; sebelum ini justru eskalasi hak — aksi paling sensitif di seluruh panel — yang tidak meninggalkan apa pun selain `users.updated_at`, sehingga sesudah insiden tidak ada cara menjawab "kapan akun ini jadi admin, dan atas perintah siapa". */
  | 'admin_grant'
  | 'admin_revoke'
  | 'suspend'
  | 'restore'
  | 'profile_override'

export async function recordAdminAction(
  tx: PoolClient,
  input: {
    adminId: number
    targetUserId: number
    action: AdminActionKind
    detail: Record<string, unknown>
    reason: string
  },
): Promise<void> {
  await tx.query(
    `insert into admin_actions(admin_id, target_user_id, action, detail, reason)
     values($1,$2,$3,$4::jsonb,$5)`,
    [
      input.adminId,
      input.targetUserId,
      input.action,
      JSON.stringify(input.detail),
      input.reason,
    ],
  )
}

function cleanReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim() ?? ''
  if (!trimmed) throw new AdminGrantError('REASON_REQUIRED', 400)
  if (trimmed.length > GRANT_REASON_MAX) throw new AdminGrantError('REASON_TOO_LONG', 400)
  return trimmed
}

function cleanCount(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > max) {
    throw new AdminGrantError('INVALID_AMOUNT', 400)
  }
  return value
}

interface LockedTarget {
  id: number
  premiumUntil: Date | null
  energy: number
  channelMember: boolean | null
  notificationsMutedAt: Date | null
}

/** Mengunci baris target sekaligus membaca keadaan SEBELUM perubahan. Nilai "sebelum" diambil di sini, bukan lewat subquery di klausa `returning` update-nya: subquery di `returning` membaca lewat snapshot perintah yang sama, jadi apakah ia melihat baris lama atau baru bukan hal yang layak dipertaruhkan pada jejak audit. Dengan `for update` sudah dipegang, membacanya lebih dulu tidak bisa balapan dengan siapa pun. */
async function lockTarget(tx: PoolClient, publicId: string): Promise<LockedTarget | null> {
  const rows = await tx.query<{
    id: string
    premium_until: Date | null
    energy: number
    channel_member: boolean | null
    notifications_muted_at: Date | null
  }>(
    `select id, premium_until, energy, channel_member, notifications_muted_at
       from users where public_id=$1 for update`,
    [publicId],
  )
  const row = rows.rows[0]
  if (!row) return null
  return {
    id: Number(row.id),
    premiumUntil: row.premium_until,
    energy: Number(row.energy),
    channelMember: row.channel_member,
    notificationsMutedAt: row.notifications_muted_at,
  }
}

interface GrantInput {
  adminId: number
  publicId: string
  reason: string
}

export interface PremiumGrantResult {
  premiumUntil: number | null
  active: boolean
}

/** Premium yang diberikan admin MENUMPUK dari tanggal berakhir yang masih berlaku, bentuk yang sama persis dengan `grantPremium` pada pembelian: user yang sudah membayar tidak boleh kehilangan sisa harinya karena admin memberi bonus tujuh hari di tengah langganannya. Satuannya hari, bukan bulan seperti jalur pembelian. Paket berbayar memang cuma 1/2/3 bulan, tapi pemberian admin menjawab hal lain — hadiah giveaway, kompensasi gangguan, akun uji — dan hampir tidak pernah jatuh tepat di kelipatan bulan. */
export async function grantUserPremium(
  input: GrantInput & { days: number },
): Promise<PremiumGrantResult | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null
  const reason = cleanReason(input.reason)
  const days = cleanCount(input.days, PREMIUM_GRANT_MAX_DAYS)

  return transaction(async (tx) => {
    const target = await lockTarget(tx, input.publicId.trim())
    if (!target) return null

    const granted = await tx.query<{ premium_until: Date; now: Date }>(
      `update users
          set premium_until = greatest(now(), coalesce(premium_until, now()))
                              + ($2::int * interval '1 day'),
              updated_at = now()
        where id = $1
        returning premium_until, now() as now`,
      [target.id, days],
    )
    const row = granted.rows[0]
    if (!row) return null

    await recordAdminAction(tx, {
      adminId: admin.id,
      targetUserId: target.id,
      action: 'premium_grant',
      detail: {
        hari: days,
        sebelum: target.premiumUntil?.toISOString() ?? null,
        sesudah: row.premium_until.toISOString(),
      },
      reason,
    })

    return {
      premiumUntil: row.premium_until.getTime(),
      active: isPremiumActive(row.premium_until.getTime(), row.now.getTime()),
    }
  })
}

/** Mencabut premium sepenuhnya, bukan memotongnya sebagian. Nilai sebelumnya disimpan di detail audit supaya pencabutan yang keliru bisa dipulihkan tepat ke tanggal semula. */
export async function revokeUserPremium(input: GrantInput): Promise<PremiumGrantResult | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null
  const reason = cleanReason(input.reason)

  return transaction(async (tx) => {
    const target = await lockTarget(tx, input.publicId.trim())
    if (!target) return null

    await tx.query('update users set premium_until = null, updated_at = now() where id = $1', [
      target.id,
    ])

    await recordAdminAction(tx, {
      adminId: admin.id,
      targetUserId: target.id,
      action: 'premium_revoke',
      detail: { sebelum: target.premiumUntil?.toISOString() ?? null },
      reason,
    })

    return { premiumUntil: null, active: false }
  })
}

export interface EnergyGrantResult {
  energy: number
  max: number
}

export async function grantUserEnergy(
  input: GrantInput & { amount: number },
): Promise<EnergyGrantResult | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null
  const reason = cleanReason(input.reason)
  const amount = cleanCount(input.amount, ENERGY_GRANT_MAX)

  return transaction(async (tx) => {
    const target = await lockTarget(tx, input.publicId.trim())
    if (!target) return null

    const granted = await grantEnergy(tx, target.id, amount)

    await recordAdminAction(tx, {
      adminId: admin.id,
      targetUserId: target.id,
      action: 'energy_grant',
      detail: {
        diminta: amount,
        sebelum: target.energy,
        sesudah: granted.state.current,
        kapasitas: granted.state.max,
      },
      reason,
    })

    return { energy: granted.state.current, max: granted.state.max }
  })
}

export interface PoolRefillResult {
  credits: number
  capacity: number
}

export async function refillUserRewardPool(
  input: GrantInput & { credits: number },
): Promise<PoolRefillResult | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null
  const reason = cleanReason(input.reason)
  const credits = cleanCount(input.credits, POOL_REFILL_MAX)

  return transaction(async (tx) => {
    const target = await lockTarget(tx, input.publicId.trim())
    if (!target) return null

    const filled = await refillRewardPool(tx, target.id, credits)

    await recordAdminAction(tx, {
      adminId: admin.id,
      targetUserId: target.id,
      action: 'pool_refill',
      detail: {
        diminta: credits,
        sebelum: filled.before,
        sesudah: filled.after,
        kapasitas: filled.capacity,
      },
      reason,
    })

    return { credits: filled.after, capacity: filled.capacity }
  })
}

/** Membuka atau memasang bisu notifikasi dari panel. Dipakai untuk user yang menekan `/stop` lalu meminta dinyalakan lagi lewat dukungan, tanpa harus menyuruhnya mengirim `/start`. Yang dimatikan tetap hanya pesan ajakan — kabar penarikan tidak pernah lewat penanda ini (migrasi 0026). */
export async function setUserNotificationsMuted(
  input: GrantInput & { muted: boolean },
): Promise<{ muted: boolean } | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null
  const reason = cleanReason(input.reason)

  return transaction(async (tx) => {
    const target = await lockTarget(tx, input.publicId.trim())
    if (!target) return null

    const updated = await tx.query<{ notifications_muted_at: Date | null }>(
      'update users set notifications_muted_at=$2 where id=$1 returning notifications_muted_at',
      [target.id, input.muted ? new Date() : null],
    )

    await recordAdminAction(tx, {
      adminId: admin.id,
      targetUserId: target.id,
      action: input.muted ? 'notifications_mute' : 'notifications_unmute',
      detail: { muted: input.muted },
      reason,
    })

    return { muted: updated.rows[0].notifications_muted_at !== null }
  })
}

/** Menghapus hasil pemeriksaan keanggotaan channel yang tersimpan, sehingga pemeriksaan berikutnya menanyakan ulang ke Telegram. Cache-nya berumur berjam-jam untuk hasil "anggota" (`MEMBER_TTL_MS` di `channel.ts`), jadi user yang keluar lalu masuk lagi — atau yang tercatat salah saat Telegram sedang bermasalah — bisa tertahan di gerbang tanpa cara keluar selain menunggu. Tombolnya sendiri memaksa pemeriksaan ulang, tapi hanya untuk hasil negatif; yang positif dan basi butuh ini. */
export async function resetUserChannelGate(input: GrantInput): Promise<{ reset: true } | null> {
  const admin = await requireAdmin()
  if (!UUID_SHAPE.test(input.publicId.trim())) return null
  const reason = cleanReason(input.reason)

  return transaction(async (tx) => {
    const target = await lockTarget(tx, input.publicId.trim())
    if (!target) return null

    await tx.query(
      'update users set channel_member=null, channel_checked_at=null where id=$1',
      [target.id],
    )

    await recordAdminAction(tx, {
      adminId: admin.id,
      targetUserId: target.id,
      action: 'channel_gate_reset',
      detail: { sebelum: target.channelMember },
      reason,
    })

    return { reset: true as const }
  })
}

export interface AdminActionEntry {
  action: string
  detail: Record<string, unknown> | null
  reason: string
  adminName: string | null
  at: number
}

export async function readAdminActions(
  targetUserId: number,
  limit = 20,
): Promise<AdminActionEntry[]> {
  const rows = await query<{
    action: string
    detail: Record<string, unknown> | null
    reason: string
    first_name: string | null
    created_at: Date
  }>(
    `select a.action, a.detail, a.reason, u.first_name, a.created_at
       from admin_actions a
       left join users u on u.id = a.admin_id
      where a.target_user_id = $1
      order by a.created_at desc, a.id desc
      limit $2`,
    [targetUserId, Math.min(100, Math.max(1, limit))],
  )
  return rows.map((row) => ({
    action: row.action,
    detail: row.detail,
    reason: row.reason,
    adminName: row.first_name,
    at: row.created_at.getTime(),
  }))
}
