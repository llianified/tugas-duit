import { createHash, timingSafeEqual } from 'node:crypto'

/** Bandingkan dua rahasia tanpa membocorkan panjang maupun posisi karakter yang cocok. Di-hash dulu supaya `timingSafeEqual` selalu menerima dua buffer sepanjang 32 byte — ia melempar kalau panjangnya beda, dan panjang rahasia yang dikirim penyerang tidak boleh jadi pembeda. */
export function matchesSecret(supplied: string, expected: string): boolean {
  const a = createHash('sha256').update(supplied).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
