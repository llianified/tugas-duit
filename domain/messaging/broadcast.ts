/** Bentuk siaran: segmen yang tersedia dan batas panjang pesannya. Aturan murni, tanpa I/O. Berdiri di `domain/` dan bukan di `server/broadcast.ts` karena penyusun pesannya adalah komponen klien: mengimpornya dari `server/` akan menyeret `db`, `next/headers`, dan klien Telegram ke dalam bundel browser. Yang tinggal di `server/` adalah query dan pengirimannya — hal-hal yang memang tidak boleh ada di klien. */

export type BroadcastSegment =
  | 'semua'
  | 'aktif_7_hari'
  | 'tidak_aktif_7_hari'
  | 'saldo_siap_tarik'
  | 'premium_aktif'

export interface BroadcastSegmentMeta {
  id: BroadcastSegment
  label: string
  description: string
}

export const BROADCAST_BODY_MAX = 3_000

export const BROADCAST_SEGMENTS: readonly BroadcastSegmentMeta[] = [
  {
    id: 'semua',
    label: 'Semua user',
    description: 'Semua akun yang pernah membuka app dan belum menekan /stop.',
  },
  {
    id: 'aktif_7_hari',
    label: 'Aktif 7 hari terakhir',
    description: 'Punya minimal satu task selesai dalam tujuh hari terakhir.',
  },
  {
    id: 'tidak_aktif_7_hari',
    label: 'Tidak aktif 7 hari+',
    description: 'Pernah mengerjakan task, tapi tidak ada yang selesai dalam tujuh hari terakhir.',
  },
  {
    id: 'saldo_siap_tarik',
    label: 'Saldo sudah cukup ditarik',
    description: 'Saldonya sudah di atas minimum penarikan tapi belum ada pengajuan berjalan.',
  },
  {
    id: 'premium_aktif',
    label: 'Premium aktif',
    description: 'Langganan premiumnya masih berlaku.',
  },
]

export function isBroadcastSegment(value: unknown): value is BroadcastSegment {
  return BROADCAST_SEGMENTS.some((segment) => segment.id === value)
}
