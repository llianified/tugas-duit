import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('HTTP-1 — clientIp mendahulukan header yang ditulis platform', () => {
  it('memakai x-vercel-forwarded-for meski x-forwarded-for dikarang', async () => {
    const { clientIp } = await import('./http')
    const request = new Request('https://tugasduit.example/api/session', {
      headers: {
        'x-forwarded-for': '9.9.9.9',
        'x-vercel-forwarded-for': '203.0.113.7',
      },
    })

    expect(clientIp(request)).toBe('203.0.113.7')
  })

  it('jatuh ke x-forwarded-for kalau platform tidak menuliskan apa pun', async () => {
    const { clientIp } = await import('./http')
    const request = new Request('https://tugasduit.example/api/session', {
      headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' },
    })

    expect(clientIp(request)).toBe('198.51.100.4')
  })

  it('menandai nilai yang bukan alamat IP alih-alih memakainya sebagai bucket', async () => {
    const { clientIp } = await import('./http')
    const request = new Request('https://tugasduit.example/api/session', {
      headers: { 'x-vercel-forwarded-for': 'bukan-ip' },
    })

    expect(clientIp(request)).toBe('malformed')
  })
})

describe('HTTP-2 — setiap GET bersesi menolak permintaan lintas-situs', () => {
  /** Dua route sempat menjadi satu-satunya yang memasang `assertNotCrossSite` pada GET, sementara saudara-saudaranya membawa data yang sama pribadinya — saldo, kode referral, tagihan premium berjalan. Tidak ada yang bisa dieksploitasi hari ini: tanpa header CORS, browser tidak mengizinkan origin lain membaca badan jawabannya. Yang hilang adalah pertahanan berlapis, dan aturan yang tidak bisa disimpulkan seorang pembaca dari kodenya. Test ini yang membuat aturannya ada. */
  it('tidak menyisakan GET bersesi tanpa penjaga lintas-situs', async () => {
    const root = path.join(process.cwd(), 'app/api')
    const entries = await readdir(root, { recursive: true })
    const routes = entries.filter((entry) => entry.endsWith('route.ts')).sort()

    expect(routes.length).toBeGreaterThan(20)

    const tanpaPenjaga: string[] = []
    for (const relative of routes) {
      const source = await readFile(path.join(root, relative), 'utf8')
      const punyaGet = /export async function GET\(/.test(source)
      const bersesi = source.includes('requireUser') || source.includes('getSessionUser')
      if (!punyaGet || !bersesi) continue
      if (!source.includes('assertNotCrossSite') && !source.includes('assertSameOrigin(request)')) {
        tanpaPenjaga.push(relative)
      }
    }

    expect(tanpaPenjaga).toEqual([])
  })
})
