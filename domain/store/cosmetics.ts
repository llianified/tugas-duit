/** Kosmetik: barang pertama di rak yang benar-benar DIMILIKI, bukan habis dipakai.
 *
 * Ia satu-satunya yang dijual aplikasi ini tanpa menyentuh ekonomi sama sekali — tidak menambah
 * energi, tidak mempercepat apa pun, tidak menggeser satu credit pun. Marginnya utuh, dan itu
 * sebabnya raknya ada: pemasukan yang tidak menaikkan liabilitas sepeser pun.
 *
 * Yang membuatnya laku bukan barangnya, melainkan panggungnya. Papan peringkat sudah memajang nama
 * depan dan foto ke seluruh user (lihat `LeaderboardEntry`), jadi bingkai dan gelar punya tempat
 * untuk dilihat orang lain. Kosmetik tanpa panggung tidak pernah terjual.
 *
 * Tampilannya TIDAK di sini. Berkas ini cuma menyimpan identitas dan nama bacanya; gradien
 * bingkainya tinggal di `shared/components/cosmetic-frame.tsx`, tempat yang memang boleh tahu soal
 * warna. */

export type CosmeticKind = 'frame' | 'title'

export type CosmeticKey =
  | 'frame_emas'
  | 'frame_langit'
  | 'frame_api'
  | 'frame_zamrud'
  | 'title_sultan'
  | 'title_kilat'
  | 'title_rajin'

export interface Cosmetic {
  key: CosmeticKey
  kind: CosmeticKind
  /** Nama barangnya di rak toko. */
  name: string
  /** Kalimat rak. Menyebut di MANA barangnya kelihatan, karena itu yang dibeli orang. */
  detail: string
  /** Yang tercetak di sebelah nama untuk gelar. Kosong untuk bingkai. */
  label: string
}

export const COSMETICS: readonly Cosmetic[] = [
  {
    key: 'frame_emas',
    kind: 'frame',
    name: 'Bingkai Emas',
    detail: 'Lingkaran emas di foto kamu, kelihatan di papan peringkat.',
    label: '',
  },
  {
    key: 'frame_langit',
    kind: 'frame',
    name: 'Bingkai Langit',
    detail: 'Biru ke ungu, adem. Kelihatan di papan peringkat.',
    label: '',
  },
  {
    key: 'frame_api',
    kind: 'frame',
    name: 'Bingkai Api',
    detail: 'Oranye menyala buat yang streak-nya panjang.',
    label: '',
  },
  {
    key: 'frame_zamrud',
    kind: 'frame',
    name: 'Bingkai Zamrud',
    detail: 'Hijau tua, paling kalem di rak.',
    label: '',
  },
  {
    key: 'title_sultan',
    kind: 'title',
    name: 'Gelar "Sultan"',
    detail: 'Tercetak di sebelah nama kamu di papan peringkat.',
    label: 'Sultan',
  },
  {
    key: 'title_kilat',
    kind: 'title',
    name: 'Gelar "Si Kilat"',
    detail: 'Buat yang jawabannya paling cepat. Tercetak di papan peringkat.',
    label: 'Si Kilat',
  },
  {
    key: 'title_rajin',
    kind: 'title',
    name: 'Gelar "Paling Rajin"',
    detail: 'Buat yang tiap hari mampir. Tercetak di papan peringkat.',
    label: 'Paling Rajin',
  },
]

export const COSMETIC_KEYS: readonly CosmeticKey[] = COSMETICS.map((item) => item.key)

export function isCosmeticKey(value: unknown): value is CosmeticKey {
  return typeof value === 'string' && COSMETIC_KEYS.includes(value as CosmeticKey)
}

export function cosmetic(key: CosmeticKey): Cosmetic {
  const found = COSMETICS.find((item) => item.key === key)
  if (!found) throw new Error(`Kosmetik tidak dikenal: ${key}`)
  return found
}

/** Bentuk yang dibaca UI. `null` di kedua sisi berarti user belum memasang apa-apa — keadaan bawaan
 * semua orang, dan yang paling sering dirender. */
export interface EquippedCosmetics {
  frame: CosmeticKey | null
  title: CosmeticKey | null
}

export const NO_COSMETICS: EquippedCosmetics = { frame: null, title: null }

/** Menyaring key yang datang dari database. Baris lama bisa memegang key yang sudah dicabut dari
 * katalog — dan bingkai yang tidak dikenal harus jadi "tidak memakai apa-apa", bukan render kosong
 * yang menggeser tata letak baris papan peringkat. */
export function readEquipped(frame: unknown, title: unknown): EquippedCosmetics {
  const asFrame = isCosmeticKey(frame) && cosmetic(frame).kind === 'frame' ? frame : null
  const asTitle = isCosmeticKey(title) && cosmetic(title).kind === 'title' ? title : null
  return { frame: asFrame, title: asTitle }
}

/** Gelar yang tercetak untuk sebuah key, atau `null` kalau tidak ada yang perlu dicetak. Dipakai
 * papan peringkat dan profil supaya keduanya tidak masing-masing menebak isi `label`. */
export function titleLabel(key: CosmeticKey | null): string | null {
  if (key === null) return null
  const found = COSMETICS.find((item) => item.key === key && item.kind === 'title')
  return found && found.label !== '' ? found.label : null
}
