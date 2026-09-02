// Codemod sekali pakai: memindahkan domain/ dan server/ ke sub-modul bounded
// context, lalu menghitung ulang SETIAP impor dari lokasi barunya.
//
// Kenapa dihitung ulang, bukan di-sed: server/ memakai impor relatif ('./db')
// di 126 tempat, dan sebagiannya wajib membawa ekstensi '.ts' karena dimuat
// `node --experimental-strip-types` dari scripts/. Menyalin path secara tekstual
// akan merusak kedalamannya. Di sini tiap specifier di-resolve ke berkas nyata
// lebih dulu, dipetakan ke lokasi barunya, baru diturunkan ulang jadi relatif —
// jadi ekstensi dan gaya impornya terjaga apa adanya.
//
// Berkas ini dihapus setelah dipakai; ia tidak pernah ikut ter-commit.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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

// Test integrasi yang memotong beberapa modul sekaligus tidak punya pemilik
// tunggal, jadi pindah ke tests/integration/ ketimbang dipaksa masuk salah satu.
const EXPLICIT = {
  'server/quota-payout.integration.test.ts': 'tests/integration/quota-payout.integration.test.ts',
  'architecture.test.ts': 'tests/architecture.test.ts',
}

// ---------------------------------------------------------------- peta pindah

/** oldRelPath -> newRelPath */
const moves = new Map()

for (const [layer, mods] of Object.entries(MODULES)) {
  for (const [mod, bases] of Object.entries(mods)) {
    for (const base of bases) {
      // Tiap base ikut membawa berkas uji yang berkolokasi dengannya.
      for (const suffix of ['.ts', '.test.ts', '.integration.test.ts']) {
        const oldRel = `${layer}/${base}${suffix}`
        try {
          statSync(path.join(ROOT, oldRel))
        } catch {
          continue
        }
        moves.set(oldRel, `${layer}/${mod}/${base}${suffix}`)
      }
    }
  }
}

for (const [oldRel, newRel] of Object.entries(EXPLICIT)) {
  moves.set(oldRel, newRel)
}

// ------------------------------------------------------------------ util path

const SOURCE_EXT = ['.ts', '.tsx']

/** Mencari berkas nyata untuk sebuah path, dengan atau tanpa ekstensi. */
function resolveFile(relNoExt) {
  const candidates = [
    relNoExt,
    ...SOURCE_EXT.map((e) => relNoExt + e),
    ...SOURCE_EXT.map((e) => `${relNoExt}/index${e}`),
  ]
  for (const c of candidates) {
    try {
      if (statSync(path.join(ROOT, c)).isFile()) return c
    } catch {
      /* lanjut */
    }
  }
  return null
}

function listSourceFiles(dir, out = []) {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.vercel'].includes(entry.name)) continue
    const rel = dir === '.' ? entry.name : `${dir}/${entry.name}`
    if (entry.isDirectory()) listSourceFiles(rel, out)
    else if (SOURCE_EXT.some((e) => entry.name.endsWith(e))) out.push(rel)
  }
  return out
}

// ------------------------------------------------------------------- pindahkan

const filesBefore = listSourceFiles('.')

for (const [oldRel, newRel] of moves) {
  mkdirSync(path.dirname(path.join(ROOT, newRel)), { recursive: true })
  execFileSync('git', ['mv', oldRel, newRel], { cwd: ROOT })
}

console.log(`[v0] dipindahkan: ${moves.size} berkas`)

// ------------------------------------------------------------ tulis ulang impor

// Semua specifier impor: from '...', import('...'), vi.mock('...'), require('...')
const SPEC_RE = /(from\s*|import\s*\(\s*|vi\.mock\s*\(\s*|require\s*\(\s*)(['"])([^'"]+)\2/g

let rewritten = 0
const unresolved = []

for (const oldRel of filesBefore) {
  const newRel = moves.get(oldRel) ?? oldRel
  const abs = path.join(ROOT, newRel)
  const src = readFileSync(abs, 'utf8')

  const oldDir = path.posix.dirname(oldRel)
  const newDir = path.posix.dirname(newRel)

  const out = src.replace(SPEC_RE, (match, head, quote, spec) => {
    let oldTargetNoExt
    let isAlias = false

    if (spec.startsWith('@/')) {
      oldTargetNoExt = spec.slice(2)
      isAlias = true
    } else if (spec.startsWith('.')) {
      // Di-resolve terhadap lokasi LAMA berkas ini, karena itulah konteks
      // saat specifier-nya dulu ditulis.
      oldTargetNoExt = path.posix.normalize(path.posix.join(oldDir, spec))
    } else {
      return match // paket npm, biarkan
    }

    const hadExt = SOURCE_EXT.some((e) => oldTargetNoExt.endsWith(e))
    const bare = hadExt ? oldTargetNoExt.replace(/\.tsx?$/, '') : oldTargetNoExt

    const resolvedOld = resolveFile(bare) ?? resolveFile(oldTargetNoExt)
    if (!resolvedOld) {
      if (isAlias) unresolved.push(`${oldRel} -> ${spec}`)
      return match // aset/berkas non-sumber
    }

    const resolvedNew = moves.get(resolvedOld) ?? resolvedOld
    // Berkas ini dan targetnya sama-sama tidak bergerak: jangan diutak-atik,
    // supaya diff-nya tetap sekecil mungkin.
    if (resolvedNew === resolvedOld && newDir === oldDir) return match

    const ext = path.posix.extname(resolvedNew)
    const newNoExt = resolvedNew.slice(0, -ext.length)

    let nextSpec
    if (isAlias) {
      nextSpec = `@/${hadExt ? resolvedNew : newNoExt}`
    } else {
      let rel = path.posix.relative(newDir, hadExt ? resolvedNew : newNoExt)
      if (!rel.startsWith('.')) rel = `./${rel}`
      nextSpec = rel
    }

    if (nextSpec === spec) return match
    rewritten += 1
    return `${head}${quote}${nextSpec}${quote}`
  })

  if (out !== src) writeFileSync(abs, out)
}

console.log(`[v0] specifier ditulis ulang: ${rewritten}`)
if (unresolved.length) {
  console.log(`[v0] alias tak ter-resolve (${unresolved.length}):`)
  for (const u of unresolved.slice(0, 20)) console.log(`  ${u}`)
}
