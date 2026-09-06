import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPurchaseRequestId,
  purchaseRequestId,
  resetPurchaseRequestIds,
} from './purchase-key'

const ROOT = path.resolve(import.meta.dirname, '../..')

describe('STORE-1 — kunci idempotensi belanja bertahan melewati umur lembar toko', () => {
  beforeEach(() => resetPurchaseRequestIds())

  it('mengembalikan kunci yang sama selama pembeliannya belum tuntas', () => {
    const first = purchaseRequestId('premium_month')
    expect(purchaseRequestId('premium_month')).toBe(first)
    expect(purchaseRequestId('premium_month')).toBe(first)
  })

  /** Inti perbaikannya. Kuncinya dulu `useRef` di dalam `useStore`, dan `useStore` hidup di dalam
   * `Dialog.Portal` yang melepas isinya tiap kali lembarnya ditutup. Menutup lembar di tengah
   * permintaan yang belum dijawab karena itu menghapus kunci yang sedang menggantung, dan ketukan
   * berikutnya memotong saldo untuk kedua kalinya. Di sini "menutup lalu membuka lagi" tidak
   * diwakili oleh apa pun — dan itulah yang dibuktikan: kuncinya memang tidak terikat komponen. */
  it('tidak kehilangan kunci saat lembarnya ditutup di tengah permintaan', () => {
    const inFlight = purchaseRequestId('premium_month')

    // Lembar ditutup, komponennya dilepas, lalu dibuka lagi. Tidak ada yang perlu dipanggil:
    // kalau kuncinya masih milik komponen, baris berikut akan menghasilkan kunci baru.
    expect(purchaseRequestId('premium_month')).toBe(inFlight)
  })

  it('membuat kunci baru hanya setelah pembeliannya benar-benar tercatat', () => {
    const paid = purchaseRequestId('energy_refill')
    clearPurchaseRequestId('energy_refill')

    expect(purchaseRequestId('energy_refill')).not.toBe(paid)
  })

  it('memisahkan kunci antar barang', () => {
    expect(purchaseRequestId('energy_refill')).not.toBe(purchaseRequestId('premium_month'))
  })

  it('melepas satu barang tanpa menyentuh yang lain', () => {
    const energy = purchaseRequestId('energy_refill')
    const premium = purchaseRequestId('premium_month')
    clearPurchaseRequestId('premium_month')

    expect(purchaseRequestId('energy_refill')).toBe(energy)
    expect(purchaseRequestId('premium_month')).not.toBe(premium)
  })

  it('berbentuk UUID, sesuai yang dituntut /api/store/buy', () => {
    expect(purchaseRequestId('energy_refill')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  /** Penjaga regresi yang paling mungkin: kuncinya dipindahkan balik ke dalam hook karena di sana
   * "kelihatan lebih rapi". Yang membuat bug lamanya mahal justru karena ia tidak terlihat salah
   * saat dibaca — komponennya benar, hook-nya benar, dan yang salah cuma umur satu Map. */
  it('tidak dibuat ulang di dalam hook yang ikut dilepas bersama lembarnya', async () => {
    const source = await readFile(path.join(ROOT, 'features/store/use-store.ts'), 'utf8')

    expect(source).not.toContain('randomUUID')
    expect(source).not.toContain('useRef')
  })
})
