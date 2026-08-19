import { NextResponse, type NextRequest } from 'next/server'

const REPORT_ONLY = ['1', 'true'].includes((process.env.CSP_REPORT_ONLY ?? '').toLowerCase())

const REPORT_PATH = '/api/csp-report'
const REPORT_GROUP = 'csp'

function buildCsp(nonce: string, isDev: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' https://telegram.org 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'none'",
    "img-src 'self' data: blob: https://t.me https://*.telegram.org",
    "media-src 'self' blob:",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
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
