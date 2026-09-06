import type { PoolClient } from 'pg'
import { applyEnergyGrant, projectEnergy } from '@/domain/economy/energy'
import { isPremiumActive } from '@/domain/economy/premium'
import { cosmetic } from '@/domain/store/cosmetics'
import type { StoreItem } from '@/domain/store/store'
import { grantPremium } from '../premium/premium'

/** Satu tempat yang benar-benar MEMBERIKAN barang toko, dipakai dua jalur pembayaran.
 *
 * Dipisah dari `buyStoreItem` waktu jalur QRIS masuk. Sebelumnya efeknya tinggal di dalam jalur
 * TD, dan menyalinnya ke jalur tunai berarti dua salinan aturan pemberian barang yang menyentuh
 * energi, premium, dan kepemilikan kosmetik — tiga hal yang salah satunya cukup untuk membuat user
 * membayar tanpa menerima. Yang dibedakan dua jalur itu cuma cara membayarnya; yang diterima user
 * harus sama persis, jadi kodenya juga satu.
 *
 * Selalu dipanggil DI DALAM transaksi yang sudah mengunci baris `users`-nya. Ia membaca ulang baris
 * itu alih-alih menerima potret dari pemanggil: potret yang dioper akan menua diam-diam di antara
 * `appendLedger` dan pemberian barangnya, dan energi adalah nilai yang memang bergerak sendiri
 * seiring waktu. */

const USER_SELECT =
  'select energy, energy_updated_at, premium_until, now() as now from users where id=$1'

interface UserRow {
  energy: number
  energy_updated_at: Date
  premium_until: Date | null
  now: Date
}

export async function applyStoreEffect(
  tx: PoolClient,
  userId: number,
  item: StoreItem,
): Promise<void> {
  const effect = item.effect

  if (effect.kind === 'premium') {
    await grantPremium(tx, userId, effect.months)
    return
  }

  if (effect.kind === 'energy') {
    const row = (await tx.query<UserRow>(USER_SELECT, [userId])).rows[0]
    if (!row) throw new Error('User tidak ditemukan')
    const now = row.now.getTime()
    const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
    const granted = applyEnergyGrant(
      { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() },
      now,
      premium,
      effect.amount,
    )
    await tx.query('update users set energy=$2, energy_updated_at=$3 where id=$1', [
      userId,
      granted.snapshot.energy,
      new Date(granted.snapshot.updatedAt),
    ])
    return
  }

  /** Menumpuk dari sisa yang masih berjalan, bukan dari sekarang — bentuk yang sama dengan
   * `grantPremium`. Tanpa `greatest`, membeli pass kedua saat yang pertama masih hidup justru
   * MEMOTONG sisanya, dan itu kerugian yang tidak akan dilaporkan siapa pun karena yang terlihat
   * cuma jam yang tiba-tiba lebih pendek. */
  if (effect.kind === 'gaspol') {
    await tx.query(
      `update users
          set gaspol_until = greatest(now(), coalesce(gaspol_until, now()))
                             + ($2::int * interval '1 minute'),
              updated_at = now()
        where id = $1`,
      [userId, effect.minutes],
    )
    return
  }

  /** Penanda waktu, bukan jatah yang dicacah. `readEligibility` melepas jeda selama penanda ini
   * lebih baru daripada pengajuan terakhir, jadi pengajuan berikutnya yang menghabiskannya —
   * tidak ada langkah konsumsi terpisah yang bisa gagal setengah jalan. */
  if (effect.kind === 'withdraw_skip') {
    await tx.query(
      'update users set withdrawal_cooldown_waived_at=now(), updated_at=now() where id=$1',
      [userId],
    )
    return
  }

  /** Kepemilikan dulu, baru dipasang. `on conflict do nothing` supaya pelunasan yang datang dua
   * kali tidak melempar — idempotensinya sudah dijaga di lapisan atas, dan yang di sini jaring
   * terakhirnya. Barangnya langsung dipakai: yang beli bingkai ingin melihatnya sekarang, bukan
   * mencari tombol pasang di layar lain. */
  if (effect.kind === 'cosmetic') {
    await tx.query(
      'insert into user_cosmetics(user_id, cosmetic_key) values($1,$2) on conflict do nothing',
      [userId, effect.cosmetic],
    )
    /** Kolomnya diturunkan dari katalog, bukan dari awalan key-nya: `frame_`/`title_` cuma
     * kebiasaan penamaan, dan kebiasaan yang dijadikan aturan akan memasang bingkai ke slot gelar
     * pada barang pertama yang namanya menyimpang. */
    const column = cosmetic(effect.cosmetic).kind === 'frame' ? 'equipped_frame' : 'equipped_title'
    await tx.query(`update users set ${column}=$2, updated_at=now() where id=$1`, [
      userId,
      effect.cosmetic,
    ])
  }
}

/** Energi yang sudah diproyeksikan ke sekarang, dipakai penolakan di kedua jalur beli. Berdiri di
 * sini supaya jalur tunai tidak perlu mengimpor separuh `server/store/store.ts` cuma untuk ini. */
export function projectedEnergy(row: UserRow): { current: number; max: number } {
  const now = row.now.getTime()
  const premium = isPremiumActive(row.premium_until ? row.premium_until.getTime() : null, now)
  const state = projectEnergy(
    { energy: Number(row.energy), updatedAt: row.energy_updated_at.getTime() },
    now,
    premium,
  )
  return { current: state.current, max: state.max }
}
