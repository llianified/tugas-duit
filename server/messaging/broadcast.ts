import { BROADCAST_BODY_MAX, type BroadcastSegment } from '@/domain/messaging/broadcast'
import { withdrawalMinimumCredits } from '@/domain/economy/economy'
import { query } from '../platform/db'
import { requireAdmin } from '../auth/session'
import { escapeTelegramHtml, openAppMarkup, sendTelegramMessage } from '../integrations/telegram'

/** Pesan siaran dari panel. Ini satu-satunya fitur di panel yang tidak bisa dibatalkan setelah dijalankan, dan risikonya bukan cuma malu: Telegram membekukan bot yang dilaporkan spam, dan bot yang beku berarti notifikasi penarikan ikut mati — jalur uang berhenti. Karena itu bentuknya sengaja lebih ketat daripada fitur panel lain: - `/stop` SELALU dihormati. Tidak ada segmen yang bisa menembusnya, dan tidak ada saklar untuk mematikan penjagaan itu. User yang minta berhenti sudah menjawab. - Jumlah penerima dihitung dan ditampilkan SEBELUM satu pesan pun berangkat, dari query yang persis sama dengan yang dipakai mengirim. - Penanda per user ditulis ke `bot_notifications` sebelum kirim, dengan `dedupe_key` berisi id siaran. Menekan "Kirim" dua kali karena ragu tidak mengirim dua kali ke siapa pun. - Satu putaran berhenti di anggaran waktunya sendiri dan melaporkan sisanya. Menekan lagi MELANJUTKAN, bukan mengulang — bentuk yang sama dengan `runEngagementNotifications`. Yang membedakannya dari `engagement.ts`: di sana pesannya dipilih sistem menurut keadaan user, di sini teksnya ditulis manusia. Jadi tidak ada `pickMessage`, dan tidak ada urutan prioritas — yang ada cuma segmen dan satu badan pesan. */

const SEND_GAP_MS = 60
const MAX_SENDS_PER_RUN = 500
const DEFAULT_SEND_BUDGET_MS = 20_000

/** Penjagaan yang berlaku untuk SETIAP segmen, tanpa kecuali. Akun yang ditangguhkan tidak diajak kembali, dan `/stop` dihormati. Keduanya di sini, bukan disalin ke tiap segmen, supaya menambah segmen baru tidak bisa melewatkannya. */
const BASE_FILTER = `u.banned_at is null and u.notifications_muted_at is null`

const SEGMENT_FILTER: Record<BroadcastSegment, string> = {
  semua: 'true',
  aktif_7_hari: `exists (select 1 from task_completions tc
     where tc.user_id = u.id and tc.completed_at > now() - interval '7 days')`,
  tidak_aktif_7_hari: `exists (select 1 from task_completions tc where tc.user_id = u.id)
    and not exists (select 1 from task_completions tc
      where tc.user_id = u.id and tc.completed_at > now() - interval '7 days')`,
  saldo_siap_tarik: `u.balance_credits >= $1::bigint
    and not exists (select 1 from withdrawals w
      where w.user_id = u.id and w.state = 'processing')`,
  premium_aktif: 'u.premium_until is not null and u.premium_until > now()',
}

const segmentParams = (segment: BroadcastSegment): unknown[] =>
  segment === 'saldo_siap_tarik' ? [withdrawalMinimumCredits()] : []

export async function countBroadcastRecipients(segment: BroadcastSegment): Promise<number> {
  await requireAdmin()
  const rows = await query<{ total: string }>(
    `select count(*) as total from users u
      where ${BASE_FILTER} and (${SEGMENT_FILTER[segment]})`,
    segmentParams(segment),
  )
  return Number(rows[0].total)
}

export interface BroadcastRun {
  id: string
  sent: number
  failed: number
  remaining: number
  done: boolean
}

/** Membuat baris siaran tanpa mengirim apa pun. Dipisah dari pengirimannya supaya id-nya — dan karena itu `dedupe_key`-nya — sudah ada sebelum pesan pertama berangkat, dan supaya putaran lanjutan menyambung ke baris yang sama alih-alih membuat siaran baru. */
export async function createBroadcast(
  segment: BroadcastSegment,
  body: string,
): Promise<{ id: string }> {
  const admin = await requireAdmin()
  const text = body.trim()
  if (!text || text.length > BROADCAST_BODY_MAX) {
    throw new Error('BROADCAST_BODY_INVALID')
  }
  const rows = await query<{ id: string }>(
    `insert into broadcasts(created_by, segment, body) values($1,$2,$3) returning id`,
    [admin.id, segment, text],
  )
  return { id: rows[0].id }
}

/** `sendGapMs` bisa disetel dengan alasan yang sama seperti `budgetMs`: uji menjalankan fungsi ini terhadap basis user uji yang menumpuk lintas berkas, dan jeda 60ms per kirim membuatnya menghabiskan puluhan detik untuk memeriksa satu invarian. Produksi memakai bawaannya — jeda itu yang menahan tempo terhadap batas laju Telegram. */
export async function runBroadcast(
  broadcastId: string,
  options: { budgetMs?: number; sendGapMs?: number } = {},
): Promise<BroadcastRun> {
  await requireAdmin()
  const deadline = Date.now() + (options.budgetMs ?? DEFAULT_SEND_BUDGET_MS)
  const gapMs = options.sendGapMs ?? SEND_GAP_MS

  const found = await query<{
    id: string
    segment: BroadcastSegment
    body: string
    sent_count: number
    failed_count: number
  }>('select id, segment, body, sent_count, failed_count from broadcasts where id=$1', [
    broadcastId,
  ])
  const broadcast = found[0]
  if (!broadcast) throw new Error('BROADCAST_NOT_FOUND')

  /** Penerima yang penandanya belum ada. `not exists` terhadap `bot_notifications` itu yang membuat putaran ini melanjutkan alih-alih mengulang, dan yang membuat klik ganda aman. */
  const params = segmentParams(broadcast.segment)
  const recipientSql = `select u.id, u.telegram_id from users u
     where ${BASE_FILTER} and (${SEGMENT_FILTER[broadcast.segment]})
       and not exists (
         select 1 from bot_notifications n
          where n.user_id = u.id and n.kind = 'broadcast' and n.dedupe_key = $${params.length + 1}
       )
     order by u.id
     limit $${params.length + 2}`

  const recipients = await query<{ id: string; telegram_id: string }>(recipientSql, [
    ...params,
    broadcastId,
    MAX_SENDS_PER_RUN,
  ])

  const markup = openAppMarkup('🎮 Buka Tugas Duit')
  const text = `<b>Tugas Duit</b>\n\n${escapeTelegramHtml(broadcast.body)}`

  let sent = 0
  let failed = 0
  for (const recipient of recipients) {
    if (Date.now() >= deadline) break

    const claimed = await query<{ id: string }>(
      `insert into bot_notifications(user_id, kind, dedupe_key) values($1,'broadcast',$2)
       on conflict do nothing returning id`,
      [Number(recipient.id), broadcastId],
    )
    if (claimed.length === 0) continue

    try {
      await sendTelegramMessage(recipient.telegram_id, text, markup)
      sent += 1
    } catch (error) {
      /** Penanda dihapus supaya putaran berikutnya boleh mencoba lagi — bentuk yang sama dengan `deliver()` di `engagement.ts`. Yang paling sering gagal di sini adalah user yang memblokir bot; percobaan ulangnya murah dan berhenti sendiri saat siarannya selesai. */
      await query('delete from bot_notifications where id=$1', [Number(claimed[0].id)])
      failed += 1
      console.warn('[broadcast] gagal kirim ke %s:', recipient.telegram_id, error)
    }
    if (gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs))
  }

  const remaining = await countBroadcastRemaining(broadcastId, broadcast.segment)
  const done = remaining === 0

  await query(
    `update broadcasts
        set sent_count = sent_count + $2,
            failed_count = failed_count + $3,
            finished_at = case when $4 then now() else finished_at end
      where id = $1`,
    [broadcastId, sent, failed, done],
  )

  return { id: broadcastId, sent, failed, remaining, done }
}

async function countBroadcastRemaining(
  broadcastId: string,
  segment: BroadcastSegment,
): Promise<number> {
  const params = segmentParams(segment)
  const rows = await query<{ total: string }>(
    `select count(*) as total from users u
      where ${BASE_FILTER} and (${SEGMENT_FILTER[segment]})
        and not exists (
          select 1 from bot_notifications n
           where n.user_id = u.id and n.kind = 'broadcast' and n.dedupe_key = $${params.length + 1}
        )`,
    [...params, broadcastId],
  )
  return Number(rows[0].total)
}

export interface BroadcastSummary {
  id: string
  segment: string
  body: string
  sentCount: number
  failedCount: number
  createdBy: string | null
  createdAt: number
  finishedAt: number | null
}

export async function readBroadcasts(limit = 20): Promise<BroadcastSummary[]> {
  await requireAdmin()
  const rows = await query<{
    id: string
    segment: string
    body: string
    sent_count: number
    failed_count: number
    first_name: string | null
    created_at: Date
    finished_at: Date | null
  }>(
    `select b.id, b.segment, b.body, b.sent_count, b.failed_count, u.first_name,
            b.created_at, b.finished_at
       from broadcasts b
       left join users u on u.id = b.created_by
      order by b.created_at desc
      limit $1`,
    [Math.min(100, Math.max(1, limit))],
  )
  return rows.map((row) => ({
    id: row.id,
    segment: row.segment,
    body: row.body,
    sentCount: Number(row.sent_count),
    failedCount: Number(row.failed_count),
    createdBy: row.first_name,
    createdAt: row.created_at.getTime(),
    finishedAt: row.finished_at?.getTime() ?? null,
  }))
}
