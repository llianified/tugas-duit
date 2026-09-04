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

/** Panel admin punya kebijakannya sendiri karena ia permukaan yang berbeda: yang di sini
 * menyetujui uang, dan satu-satunya alasan Mini App melonggarkan `script-src`, `img-src`, dan
 * teman-temannya adalah jaringan iklan — yang tidak pernah dirender di sini. `'strict-dynamic'`
 * tanpa host iklan berarti tidak ada satu pun kode pihak ketiga yang boleh dieksekusi di halaman
 * yang membawa cookie sesi admin. `frame-ancestors 'none'` menutup clickjacking terhadap tombol
 * yang menandai payout lunas; daftar dev tetap dipertahankan di luar produksi supaya pratinjau
 * tidak ikut mati. */
function buildCsp(nonce: string, isDev: boolean, isAdmin: boolean) {
  if (isAdmin) {
    return [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self'",
      "frame-src 'none'",
      "worker-src 'self' blob:",
      "font-src 'self'",
      `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-ancestors ${isDev ? DEV_FRAME_ANCESTORS.join(' ') : "'none'"}`,
      ...(isDev ? [] : ['upgrade-insecure-requests']),
      `report-uri ${REPORT_PATH}`,
      `report-to ${REPORT_GROUP}`,
    ].join('; ')
  }

  const frameAncestors = [
    "'self'",
    'https://web.telegram.org',
    'https://telegram.org',
    ...(isDev ? DEV_FRAME_ANCESTORS : []),
  ].join(' ')

  // Script tetap dibatasi ke origin loader SDK-nya; host kreatif tidak ditebak di sini.
  // Sejak rewarded ikut pindah ke Monetag, keluarga `libtl.com` adalah satu-satunya yang
  // perlu mengeksekusi script — dan itu keluarga yang sudah dipanen lewat report-only.
  // Keluarga `onclckvd.com` dicabut bersama loader-nya: allowlist yang tidak lagi punya
  // pemakai adalah permukaan serang tanpa imbalan.
  const adHosts = ['https://libtl.com', 'https://*.libtl.com'].join(' ')

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

/** Permukaan admin adalah halaman panelnya sekaligus API-nya: keduanya hanya boleh dicapai dari
 * dokumen yang tidak pernah memuat kode pihak ketiga. */
export function isAdminPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')
  )
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const isDev = process.env.NODE_ENV === 'development'
  const csp = buildCsp(nonce, isDev, isAdminPath(request.nextUrl.pathname))

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
