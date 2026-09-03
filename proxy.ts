import { NextResponse, type NextRequest } from 'next/server'

const REPORT_ONLY = ['1', 'true'].includes((process.env.CSP_REPORT_ONLY ?? '').toLowerCase())

const REPORT_PATH = '/api/csp-report'
const REPORT_GROUP = 'csp'

// Kebijakan dan prosedur audit provider iklan: docs/adr/0001-csp-jaringan-iklan.md.
const DEV_FRAME_ANCESTORS = [
  'https://*.vusercontent.net',
  'https://*.v0.build',
  'https://*.vercel.run',
  'https://v0.app',
  'http://localhost:*',
]

function buildCsp(nonce: string, isDev: boolean) {
  const frameAncestors = [
    "'self'",
    'https://web.telegram.org',
    'https://telegram.org',
    ...(isDev ? DEV_FRAME_ANCESTORS : []),
  ].join(' ')

  // Script tetap dibatasi ke origin loader kedua SDK; host kreatif tidak ditebak di sini.
  // Giga.pub adalah layer mediasi: loader `ad.gigapub.tech` menyuntikkan SDK jaringan
  // lain (mis. Monetag zone 11612237 dari `munqu.com` dan bidder `bid-net.gigapub.tech`).
  // Di produksi `'strict-dynamic'` sudah mengizinkannya, tetapi di dev allowlist inilah
  // yang berlaku. Host di bawah dibuktikan dari isi loader project 7799.
  const adHosts = [
    'https://libtl.com',
    'https://*.libtl.com',
    'https://ad.gigapub.tech',
    'https://*.gigapub.tech',
    'https://munqu.com',
  ].join(' ')

  const scriptSrc = isDev
    ? `script-src 'self' https://telegram.org ${adHosts} 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' https://telegram.org ${adHosts} 'nonce-${nonce}' 'strict-dynamic'`

  // Kedua provider dapat merender iframe dan media dari host HTTPS yang berubah.
  const adRenderHosts = 'https:'

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${adRenderHosts}`,
    `media-src 'self' blob: ${adRenderHosts}`,
    `frame-src 'self' blob: ${adRenderHosts}`,
    "worker-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ${adRenderHosts}${isDev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    ...(isDev ? [] : ['upgrade-insecure-requests']),
    `report-uri ${REPORT_PATH}`,
    `report-to ${REPORT_GROUP}`,
  ].join('; ')
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const isDev = process.env.NODE_ENV === 'development'
  const csp = buildCsp(nonce, isDev)

  const headerName = REPORT_ONLY
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy'

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set(headerName, csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set(headerName, csp)
  response.headers.set('Reporting-Endpoints', `${REPORT_GROUP}="${REPORT_PATH}"`)
  return response
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|icon.png|apple-icon).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
