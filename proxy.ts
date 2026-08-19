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
 * PENTING: `'strict-dynamic'` HANYA berlaku untuk `script-src`. Direktif itu tidak
 * berpengaruh apa pun pada `img-src`, `frame-src`, `media-src`, atau `connect-src` —
 * keempatnya tetap dinilai ketat per-host. Jadi walaupun SDK berhasil dimuat, kreatif
 * iklan (gambar/iframe/video) akan diblokir selama host-nya belum terdaftar di
 * keempat direktif itu, dan gejalanya: tombol iklan diklik tapi layar kosong,
 * impressions di dashboard Adsgram tetap nol. Selama panen §5 belum dijalankan,
 * deploy dengan `CSP_REPORT_ONLY=1` supaya iklan tetap render.
 *
 * Soal `frame-ancestors`: app ini dibuka langsung dari browser, bukan cuma di dalam
 * Telegram. Membatasi frame-ancestors ke host Telegram membuat browser menolak
 * me-render app di host lain (termasuk iframe preview), dan host itu memuat ulang
 * terus sampai tampilannya kedip-kedip. Jadi `'self'` selalu diizinkan, host Telegram
 * tetap dipertahankan supaya Mini App yang lama belum putus, dan di development
 * origin preview ikut diizinkan.
 *
 * Di development `script-src` sengaja memakai `'unsafe-inline'` tanpa nonce: harness
 * preview menyuntikkan inline script tanpa nonce, dan kalau diblokir preview-nya ikut
 * reload-loop. Nonce + `'strict-dynamic'` tetap dipakai penuh di production.
 */
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

  const scriptSrc = isDev
    ? "script-src 'self' https://telegram.org https://sad.adsgram.ai 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' https://telegram.org https://sad.adsgram.ai 'nonce-${nonce}' 'strict-dynamic'`

  return [
    "default-src 'self'",
    scriptSrc,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'none'",
    "img-src 'self' data: blob: https://t.me https://*.telegram.org",
    "media-src 'self' blob:",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' https://sad.adsgram.ai${isDev ? ' ws: wss:' : ''}`,
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
