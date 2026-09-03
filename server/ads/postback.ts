import { isTicketId } from '@/domain/ads/ads'
import type { AdPostbackParams } from '@/domain/ads/postback'
import { economyConfig } from '@/domain/economy/economy-config'
import { transaction } from '../platform/db'

/** Yang bisa terjadi pada satu postback. Dikembalikan apa adanya ke route supaya jawabannya bisa dibaca saat menguji URL dari dashboard Monetag — tanpa itu, "postback sudah masuk tapi tiket tidak keluar" cuma bisa ditebak. */
export type AdPostbackOutcome =
  /** Tiket dipromosikan jadi pass siap pakai. */
  | 'granted'
  /** Konfirmasinya dicatat, tapi tiketnya sudah lewat state `pending` — sudah diklaim jalur lama, sudah dipakai, atau user sedang memegang pass lain. */
  | 'noted'
  /** Tayangan sah tapi tiketnya keburu hangus. Kalau ini sering muncul, `adsTicketTtlSeconds` lebih pendek daripada waktu tempuh postback Monetag. */
  | 'ticket_expired'
  | 'unknown_ticket'
  | 'not_paid'

/** Satu-satunya jalur yang boleh menerbitkan pass saat `adsPostbackRequired` menyala. | Yang diperiksa cuma satu hal: Monetag membayar event ini atau tidak. Bukan durasi, bukan jenis event — `impression` maupun `click` sama-sama sah asal berbayar, karena keduanya berarti uang benar-benar masuk. Tayangan yang disaring Monetag sebagai fraud datang sebagai tidak berbayar dan berhenti di sini, dan itulah yang menutup celah "tap iklan lalu back". */
export async function settleAdPostback(params: AdPostbackParams): Promise<AdPostbackOutcome> {
  if (!params.paid) return 'not_paid'
  if (!params.ymid || !isTicketId(params.ymid)) return 'unknown_ticket'
  const ticketId = params.ymid

  return transaction(async (tx) => {
    const locked = await tx.query<{
      user_id: string
      state: string
      expires_at: Date
      verified_at: Date | null
      now: Date
    }>(
      'select user_id, state, expires_at, verified_at, now() as now from ad_views where id=$1 for update',
      [ticketId],
    )
    const row = locked.rows[0]
    if (!row) return 'unknown_ticket'

    /** Jejaknya ditulis sekali saja. Monetag mengulang kirim dengan `ymid` yang sama sampai dijawab 200, dan konfirmasi kedua tidak boleh menggeser waktu konfirmasi pertama. */
    if (!row.verified_at) {
      await tx.query(
        'update ad_views set verified_at=now(), verify_event=$2, verify_price=$3 where id=$1 and verified_at is null',
        [ticketId, params.event ?? 'impression', params.price],
      )
    }

    if (row.state !== 'pending') return 'noted'
    if (row.expires_at.getTime() <= row.now.getTime()) {
      await tx.query("update ad_views set state='expired' where id=$1 and state='pending'", [
        ticketId,
      ])
      return 'ticket_expired'
    }

    /** Bentuk `not exists` dipakai, bukan menangkap pelanggaran `ad_views_one_ready`: exception di dalam transaksi ikut membatalkan penulisan `verified_at` di atas, sehingga jejak konfirmasinya hilang justru pada kasus yang paling perlu terbaca. Pola yang sama sudah dipakai `restoreAdPass`. */
    const promoted = await tx.query(
      `update ad_views
          set state='ready', ready_at=now(), expires_at=now()+($3::int * interval '1 minute')
        where id=$1 and state='pending'
          and not exists (
            select 1 from ad_views other where other.user_id=$2 and other.state='ready'
          )
        returning id`,
      [ticketId, row.user_id, economyConfig().adsPassTtlMinutes],
    )
    return promoted.rowCount === 0 ? 'noted' : 'granted'
  })
}
