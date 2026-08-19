import { NextResponse, type NextRequest } from 'next/server'

const REPORT_ONLY = ['1', 'true'].includes((process.env.CSP_REPORT_ONLY ?? '').toLowerCase())

const REPORT_PATH = '/api/csp-report'
const REPORT_GROUP = 'csp'

/**
 * Host Adsgram yang tercantum di sini hanya SDK-nya (`sad.adsgram.ai`), karena itu
 * satu-satunya host yang didokumentasikan. Domain kreatif iklannya tidak punya daftar
 * tetap, jadi **jangan menebak host tambahan**: jalankan deploy percobaan dengan
 * `CSP_REPORT_ONLY=1`, panen pelanggaran nyata dari `/api/csp-report`, baru tambahkan
 * host hasil panen itu ke `frame-src`, `img-src`, `media-src`, dan `connect-src`.
 * Urutannya ada di `docs/rencana-adsgram.md` §5.
 *
 * `'strict-dynamic'` sudah mengizinkan SDK bernonce memuat turunannya di browser modern;
 * entri host tetap ditulis sebagai jaring untuk browser yang mengabaikannya.
 * `frame-ancestors` sengaja tidak disentuh — app tetap hanya boleh di-embed Telegram.
 */
function buildCsp(nonce: string, isDev: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' https://telegram.org https://sad.adsgram.ai 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'none'",
    "img-src 'self' data: blob: https://t.me https://*.telegram.org",
    "media-src 'self' blob:",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self' https://sad.adsgram.ai",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors https://web.telegram.org https://telegram.org",
    'upgrade-insecure-requests',
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
