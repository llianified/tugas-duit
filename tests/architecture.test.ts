import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Berkas ini ada di `tests/`, jadi root repo berada satu tingkat di atasnya.
// Semua path layer di bawah di-resolve terhadap root, bukan terhadap `tests/`.
const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCE_ROOTS = ['app', 'domain', 'features', 'navigation', 'server', 'shared', 'shell'] as const
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const IMPORT_PATTERN = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

const FORBIDDEN_DEPENDENCIES: Record<string, ReadonlySet<string>> = {
  domain: new Set(['app', 'features', 'navigation', 'server', 'shared', 'shell']),
  shared: new Set(['app', 'features', 'server', 'shell']),
  features: new Set(['app', 'server']),
  navigation: new Set(['app', 'server']),
  shell: new Set(['app', 'server']),
  server: new Set(['app', 'features', 'navigation', 'shell']),
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory)
  const files: string[] = []

  for (const entry of entries) {
    const absolute = path.join(directory, entry)
    const details = await stat(absolute)
    if (details.isDirectory()) files.push(...(await sourceFiles(absolute)))
    else if (SOURCE_EXTENSIONS.has(path.extname(entry))) files.push(absolute)
  }

  return files
}

function importedLayer(file: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) return specifier.slice(2).split('/')[0] ?? null
  if (!specifier.startsWith('.')) return null

  const resolved = path.resolve(path.dirname(file), specifier)
  const relative = path.relative(ROOT, resolved)
  return relative.startsWith('..') ? null : relative.split(path.sep)[0] ?? null
}

async function importsIn(file: string): Promise<string[]> {
  const source = await readFile(file, 'utf8')
  return [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1] ?? match[2])
}

function findCycle(graph: ReadonlyMap<string, ReadonlySet<string>>): string[] | null {
  const visited = new Set<string>()
  const active = new Set<string>()
  const stack: string[] = []

  function visit(node: string): string[] | null {
    if (active.has(node)) return [...stack.slice(stack.indexOf(node)), node]
    if (visited.has(node)) return null

    visited.add(node)
    active.add(node)
    stack.push(node)

    for (const dependency of graph.get(node) ?? []) {
      const cycle = visit(dependency)
      if (cycle) return cycle
    }

    stack.pop()
    active.delete(node)
    return null
  }

  for (const node of graph.keys()) {
    const cycle = visit(node)
    if (cycle) return cycle
  }

  return null
}

describe('batas arsitektur', () => {
  it('menjaga arah dependensi antar-layer', async () => {
    const violations: string[] = []

    for (const root of SOURCE_ROOTS) {
      for (const file of await sourceFiles(path.join(ROOT, root))) {
        for (const specifier of await importsIn(file)) {
          const dependency = importedLayer(file, specifier)
          if (dependency && FORBIDDEN_DEPENDENCIES[root]?.has(dependency)) {
            violations.push(`${path.relative(ROOT, file)} -> ${specifier}`)
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('mencegah siklus dependensi antar-feature', async () => {
    const graph = new Map<string, Set<string>>()

    for (const file of await sourceFiles(path.join(ROOT, 'features'))) {
      const owner = path.relative(path.join(ROOT, 'features'), file).split(path.sep)[0]
      const dependencies = graph.get(owner) ?? new Set<string>()
      graph.set(owner, dependencies)

      for (const specifier of await importsIn(file)) {
        const match = specifier.match(/^@\/features\/([^/]+)/)
        if (match?.[1] && match[1] !== owner) dependencies.add(match[1])
      }
    }

    const cycle = findCycle(graph)
    expect(cycle, cycle?.join(' -> ')).toBeNull()
  })

  it('menyimpan business rules di domain root, bukan features/*/domain.ts', async () => {
    const featureFiles = await sourceFiles(path.join(ROOT, 'features'))
    const ambiguous = featureFiles
      .filter((file) => path.basename(file) === 'domain.ts')
      .map((file) => path.relative(ROOT, file))

    expect(ambiguous).toEqual([])
  })

  /** Aturan keras #3 di `CLAUDE.md`: konversi credit → Rupiah hanya lewat `creditsToRupiah`. Ditegakkan di sini karena pelanggarannya tidak pernah gagal — hasilnya identik hari ini, dan baru menyimpang diam-diam begitu konversinya dapat aturan (pembulatan, potongan, satuan lain). `TurboRewardCard` sempat mengalikan sendiri di empat tempat tanpa ada satu pun tes yang keberatan. Angkanya sendiri tetap boleh dibaca di `domain/` (yang mendefinisikan konversinya), di `server/` (yang menyimpan dan memvalidasinya), dan di panel admin (yang memang menyunting field-nya). */
  it('menjaga konversi credit ke Rupiah lewat satu fungsi', async () => {
    const layers = ['features', 'shell', 'shared', 'navigation'] as const
    const violations: string[] = []

    for (const root of layers) {
      for (const file of await sourceFiles(path.join(ROOT, root))) {
        if (file.includes('.test.')) continue
        if ((await readFile(file, 'utf8')).includes('creditValueIdr')) {
          violations.push(`${path.relative(ROOT, file)} memakai creditValueIdr langsung`)
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  /** SWR mengunci cache-nya pada KEY, bukan pada fetcher. Dua pemakai key yang sama dengan fetcher
   * berbeda karena itu saling menimpa, dan yang menang berpindah-pindah mengikuti siapa yang
   * memenangkan revalidasi. `/api/missions` pernah begitu: shell memakai `fetchJson` polos
   * sementara kartu misi memakai fetcher yang menambahkan `receivedAt`, jadi revalidasi yang
   * dimenangkan shell menulis potret tanpa `receivedAt` — dan hitung mundur konfirmasi misi sosial
   * berubah jadi `NaN`, membuka tombol konfirmasi sebelum jedanya lewat. Bentuk kegagalannya diam:
   * TypeScript tetap puas karena tiap hook mendeklarasikan tipenya sendiri.
   *
   * Yang dijaga di sini satu hal yang bisa dilihat mesin — key-nya cuma boleh ditulis di satu
   * tempat, berdampingan dengan fetcher-nya. */
  it('menyajikan tiap key SWR bersama satu fetcher', async () => {
    const owner = path.join(ROOT, 'shell', 'session-api.ts')
    const shared = ["'/api/missions'"]
    const violations: string[] = []

    for (const root of ['shell', 'features'] as const) {
      for (const file of await sourceFiles(path.join(ROOT, root))) {
        if (file === owner || file.includes('.test.')) continue
        const source = await readFile(file, 'utf8')
        for (const key of shared) {
          if (source.includes(key)) {
            violations.push(
              `${path.relative(ROOT, file)} menulis ${key} langsung — pakai konstanta dan fetcher dari shell/session-api.ts`,
            )
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('mencegah source produksi mengimpor fixture test', async () => {
    const violations: string[] = []

    for (const root of SOURCE_ROOTS) {
      for (const file of await sourceFiles(path.join(ROOT, root))) {
        if (file.includes(`${path.sep}__fixtures__${path.sep}`) || file.includes('.test.')) continue

        for (const specifier of await importsIn(file)) {
          if (specifier.includes('/__fixtures__/')) {
            violations.push(`${path.relative(ROOT, file)} -> ${specifier}`)
          }
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })

  it('mengecualikan PGlite dari trace semua Function produksi', async () => {
    const config = await readFile(path.join(ROOT, 'next.config.mjs'), 'utf8')

    expect(config).toContain("outputFileTracingExcludes: { '/*': ['**/@electric-sql/pglite*'] }")
    expect(config).not.toContain("outputFileTracingExcludes: { '**/*':")
  })
})
