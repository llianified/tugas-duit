import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = import.meta.dirname
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
})
