// Phase 2: tulis ulang impor setelah berkasnya dipindahkan.
//
// Phase 1 keliru me-resolve specifier lewat filesystem padahal `git mv` sudah
// jalan, jadi 468 alias gagal ketemu dan dibiarkan menunjuk path lama. Di sini
// resolusinya dilakukan terhadap DAFTAR BERKAS LAMA yang direkonstruksi dari
// peta pindah — bukan dari disk — sehingga tidak bergantung pada keadaan disk
// saat skrip jalan, dan aman dijalankan berulang (idempoten).
//
// Berkas ini dihapus setelah dipakai; ia tidak pernah ikut ter-commit.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = '/vercel/share/v0-project'

const MODULES = {
  domain: {
    economy: [
      'economy', 'economy-config', 'economy-presets', 'reward-pool',
      'energy', 'referral', 'withdrawal', 'premium',
    ],
    progression: [
      'progression', 'prestige', 'stars', 'missions', 'leaderboard',
      'stats', 'activity',
    ],
    task: ['challenge'],
    ads: ['ads', 'in-app-ads', 'monetag-zone'],
    messaging: ['broadcast'],
  },
  server: {
    platform: ['db', 'preview-db', 'env', 'http', 'secret', 'ratelimit', 'seed-preview'],
    auth: ['session', 'admin-auth'],
    admin: ['admin-grants', 'admin-ops', 'admin-stats', 'admin-users'],
    economy: [
      'economy-config', 'ledger', 'quota', 'reward-pool', 'energy',
      'referral', 'streak-sql',
    ],
    payout: ['payout', 'payout-rules', 'payout-proof'],
    premium: ['premium', 'premium-payment'],
    task: ['challenge', 'missions', 'fraud', 'activity', 'history', 'stats', 'leaderboard'],
    ads: ['ads', 'ad-provider'],
    integrations: ['telegram', 'klikqris', 'channel'],
    messaging: ['notify', 'engagement', 'broadcast'],
    ops: ['maintenance'],
  },
}

const EXPLICIT = {
  'server/quota-payout.integration.test.ts': 'tests/integration/quota-payout.integration.test.ts',
  'architecture.test.ts': 'tests/architecture.test.ts',
}

const SOURCE_EXT = ['.ts', '.tsx']

function listSourceFiles(dir, out = []) {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.vercel'].includes(entry.name)) continue
    const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`
    if (entry.isDirectory()) listSourceFiles(rel, out)
    else if (SOURCE_EXT.some((e) => entry.name.endsWith(e))) out.push(rel)
  }
  return out
}

const currentFiles = listSourceFiles('.').filter((f) => !f.startsWith('.v0-'))

// --- peta pindah, diturunkan dari keadaan disk SEKARANG (pasca phase 1) ------

/** newRelPath -> oldRelPath */
const inverse = new Map()

for (const [layer, mods] of Object.entries(MODULES)) {
  for (const [mod, bases] of Object.entries(mods)) {
    for (const base of bases) {
      for (const suffix of ['.ts', '.test.ts', '.integration.test.ts']) {
        const newRel = `${layer}/${mod}/${base}${suffix}`
        if (currentFiles.includes(newRel)) inverse.set(newRel, `${layer}/${base}${suffix}`)
      }
    }
  }
}
for (const [oldRel, newRel] of Object.entries(EXPLICIT)) {
  if (currentFiles.includes(newRel)) inverse.set(newRel, oldRel)
}

/** oldRelPath -> newRelPath */
const moves = new Map([...inverse].map(([n, o]) => [o, n]))

// Daftar berkas seperti SEBELUM pindah — inilah basis resolusi specifier.
const oldFiles = new Set(currentFiles.map((f) => inverse.get(f) ?? f))

/** Resolusi path (dengan/tanpa ekstensi) terhadap daftar berkas lama. */
function resolveOld(rel) {
  const candidates = [
    rel,
    ...SOURCE_EXT.map((e) => rel + e),
    ...SOURCE_EXT.map((e) => `${rel}/index${e}`),
  ]
  return candidates.find((c) => oldFiles.has(c)) ?? null
}

console.log(`[v0] berkas dipetakan: ${moves.size}`)

// ------------------------------------------------------------ tulis ulang impor

const SPEC_RE = /(from\s*|import\s*\(\s*|vi\.mock\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\2/g

let rewritten = 0
let touched = 0
const unresolved = []

for (const newRel of currentFiles) {
  const oldRel = inverse.get(newRel) ?? newRel
  const abs = path.join(ROOT, newRel)
  const src = readFileSync(abs, 'utf8')

  const oldDir = path.posix.dirname(oldRel)
  const newDir = path.posix.dirname(newRel)

  const out = src.replace(SPEC_RE, (match, head, quote, spec) => {
    let oldTarget
    let isAlias = false

    if (spec.startsWith('@/')) {
      oldTarget = spec.slice(2)
      isAlias = true
    } else if (spec.startsWith('.')) {
      // Relatif terhadap lokasi LAMA berkas ini: itulah konteks saat
      // specifier-nya ditulis. Yang sudah benar akan gagal di-resolve di sini
      // dan dibiarkan apa adanya — itu yang membuat skrip ini idempoten.
      oldTarget = path.posix.normalize(path.posix.join(oldDir, spec))
    } else {
      return match // paket npm
    }

    const hadExt = SOURCE_EXT.some((e) => oldTarget.endsWith(e))
    const bare = hadExt ? oldTarget.replace(/\.tsx?$/, '') : oldTarget

    const resolvedOld = resolveOld(bare)
    if (!resolvedOld) {
      if (isAlias) unresolved.push(`${newRel} -> ${spec}`)
      return match
    }

    const resolvedNew = moves.get(resolvedOld) ?? resolvedOld
    if (resolvedNew === resolvedOld && newDir === oldDir) return match

    const ext = path.posix.extname(resolvedNew)
    const target = hadExt ? resolvedNew : resolvedNew.slice(0, -ext.length)

    let nextSpec
    if (isAlias) {
      nextSpec = `@/${target}`
    } else {
      let rel = path.posix.relative(newDir, target)
      if (!rel.startsWith('.')) rel = `./${rel}`
      nextSpec = rel
    }

    if (nextSpec === spec) return match
    rewritten += 1
    return `${head}${quote}${nextSpec}${quote}`
  })

  if (out !== src) {
    writeFileSync(abs, out)
    touched += 1
  }
}

console.log(`[v0] specifier ditulis ulang: ${rewritten} di ${touched} berkas`)
if (unresolved.length) {
  console.log(`[v0] alias tak ter-resolve (${unresolved.length}) — cek manual:`)
  for (const u of unresolved.slice(0, 25)) console.log(`  ${u}`)
}
