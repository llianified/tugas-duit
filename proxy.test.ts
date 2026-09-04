import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from './proxy'

const ROOT = import.meta.dirname

const cspFor = (pathname: string): string => {
  const response = proxy(new NextRequest(`https://tugasduit.example${pathname}`))
  return response.headers.get('Content-Security-Policy') ?? ''
}

const directiveOf = (csp: string, name: string): string =>
  csp
    .split('; ')
    .find((directive) => directive.startsWith(`${name} `) || directive === name) ?? ''

describe('CSP-1 — panel admin tidak berbagi kelonggaran Mini App', () => {
  /** P0-01: selama panel admin dilayani CSP yang sama dengan Mini App, satu skrip pihak ketiga
   * di dalam browser admin bisa memanggil `/api/admin/*` same-origin dengan cookie sesi admin. */
  it('tidak mengizinkan host iklan mengeksekusi script di halaman admin', () => {
    for (const pathname of ['/admin', '/admin/withdrawals', '/api/admin/adjustments']) {
      const scriptSrc = directiveOf(cspFor(pathname), 'script-src')
      expect(scriptSrc).not.toContain('libtl.com')
      expect(scriptSrc).toContain("'self'")
      expect(scriptSrc).toContain("'strict-dynamic'")
    }
  })

  it('menolak dibingkai siapa pun di halaman admin', () => {
    expect(directiveOf(cspFor('/admin/withdrawals'), 'frame-ancestors')).toBe(
      "frame-ancestors 'none'",
    )
  })

  it('tidak membuka img, media, frame, dan connect ke seluruh https', () => {
    const csp = cspFor('/admin/users')
    for (const name of ['img-src', 'media-src', 'frame-src', 'connect-src']) {
      expect(directiveOf(csp, name)).not.toMatch(/\bhttps:/)
    }
  })
})

describe('CSP-2 — Mini App tetap seperti semula', () => {
  it('mengizinkan loader Monetag dan pembingkaian oleh Telegram', () => {
    const csp = cspFor('/')
    expect(directiveOf(csp, 'script-src')).toContain('https://libtl.com')
    expect(directiveOf(csp, 'frame-ancestors')).toContain('https://web.telegram.org')
  })
})

describe('CSP-3 — root layout admin bebas skrip pihak ketiga', () => {
  /** Kebijakan saja tidak cukup: selama `<Script src="https://…">` masih dirender di pohon yang
   * menaungi `/admin/*`, satu perubahan CSP yang lalai mengembalikan seluruh masalahnya. */
  it('tidak merender satu pun script berorigin luar', async () => {
    const source = await readFile(path.join(ROOT, 'app/(admin)/layout.tsx'), 'utf8')
    expect(source).toContain('<html')
    expect(source).toContain('<body')
    expect(source).not.toMatch(/src=\{?["']https:/)
  })
})
