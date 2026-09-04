import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')

/** `CLAUDE.md` menyuruh membaca `docs/` sebelum "memperbaiki" sesuatu yang terlihat janggal, jadi dokumen-dokumen itu dipakai untuk mengambil keputusan. Isinya bisa tetap benar sementara penunjuknya membusuk: satu refactor yang memindahkan berkas membuat setiap baris "Ditegakkan di" menunjuk ke tempat yang tidak ada lagi, dan tidak ada satu pun test yang gagal karenanya. Test ini yang gagal. Berkas ADR sengaja dikecualikan — isinya catatan sejarah, dan sebagian memang menyebut berkas yang dihapus oleh keputusan yang dicatatnya. */
const DOKUMEN = ['CLAUDE.md', 'server/CLAUDE.md', 'docs/keputusan-desain.md']

/** Path relatif terhadap direktori dokumennya, bukan terhadap root: `server/CLAUDE.md` menyebut `economy/ledger.ts` apa adanya. */
const PATH_PATTERN = /`([^`\s]+\.(?:ts|tsx|sql|json|mjs|css))`/g

async function ada(candidate: string): Promise<boolean> {
  try {
    await stat(candidate)
    return true
  } catch {
    return false
  }
}

describe('DOC-1 — setiap berkas yang disebut dokumen memang ada', () => {
  it('tidak menyisakan penunjuk yang membusuk', async () => {
    const hilang: string[] = []

    for (const dokumen of DOKUMEN) {
      const source = await readFile(path.join(ROOT, dokumen), 'utf8')
      const base = path.dirname(path.join(ROOT, dokumen))

      for (const match of source.matchAll(PATH_PATTERN)) {
        const raw = match[1].startsWith('@/') ? match[1].slice(2) : match[1]
        if (!raw.includes('/')) continue
        const kandidat = [path.join(base, raw), path.join(ROOT, raw)]
        const found = await Promise.all(kandidat.map(ada))
        if (!found.some(Boolean)) hilang.push(`${dokumen} → ${raw}`)
      }
    }

    expect(hilang).toEqual([])
  })

  it('menyebut migrasi yang benar-benar ada', async () => {
    const source = await readFile(path.join(ROOT, 'docs/keputusan-desain.md'), 'utf8')
    const berkas = await readdir(path.join(ROOT, 'db/migrations'))
    const nomor = new Set(berkas.map((name) => name.slice(0, 4)))

    const hilang = [...source.matchAll(/migrasi `(\d{4})`/g)]
      .map((match) => match[1])
      .filter((angka) => !nomor.has(angka))

    expect(hilang).toEqual([])
  })
})
