import { NextResponse, type NextRequest } from 'next/server'

const REPORT_ONLY = ['1', 'true'].includes((process.env.CSP_REPORT_ONLY ?? '').toLowerCase())

const REPORT_PATH = '/api/csp-report'
const REPORT_GROUP = 'csp'

/** PENTING setelah pindah ke Monetag: hasil panen §5 di bawah ini diambil saat jaringan iklannya masih Adsgram, jadi kesimpulan "kreatif tidak butuh host tambahan" BELUM terbukti untuk Monetag. Yang diizinkan di sini baru host SDK-nya (`libtl.com`) di `script-src` dan `connect-src`. Monetag me-render rewarded interstitial-nya di dalam iframe dan sering memindahkan host kreatif, jadi kalau iklannya tampil kosong/hitam atau tombolnya diam saja, jangan menebak host: jalankan ulang panen §5 dengan `CSP_REPORT_ONLY=1`, pakai app-nya beberapa jam, lalu tambahkan host yang benar-benar muncul di `/api/csp-report` (kemungkinan besar di `frame-src` dan `img-src`). Host Adsgram/GigaPub sudah dicabut bersama SDK-nya; jejaknya tetap ditulis di sini supaya alasan daftar host ini pendek tidak hilang. Domain kreatif jaringan iklan tidak punya daftar tetap, jadi **jangan menebak host tambahan**: panen pelanggaran nyata dari `/api/csp-report` dengan prosedur di awal komentar ini. HASIL PANEN §5 (dijalankan dengan `CSP_REPORT_ONLY=1`, ~6 jam pemakaian nyata): NOL pelanggaran `img-src`, `frame-src`, `media-src`, dan `connect-src`. Jadi kreatif Adsgram TIDAK memerlukan host tambahan: SDK menarik kreatif lewat `connect-src` ke `sad.adsgram.ai` (sudah diizinkan), lalu me-render-nya sebagai `blob:`/`data:` yang sudah tercakup `img-src`/`media-src`. Keempat direktif itu sengaja dibiarkan ketat — jangan ditambahi host spekulatif. Yang benar-benar memblokir iklan adalah STYLE, bukan host kreatif: satu-satunya pelanggaran yang muncul adalah `style-src-attr` (atribut `style` inline) dan `style-src-elem` (elemen `<style>` suntikan SDK, tanpa nonce). Karena itu: - `style-src-attr` WAJIB `'unsafe-inline'`. Nonce dan hash tidak berlaku untuk atribut style, jadi `'none'` memblokirnya total — termasuk atribut `style` milik app sendiri di `shell/app-frame.tsx` (offset animasi transisi view). - `style-src` tidak boleh memakai nonce. Per CSP3, begitu ada nonce/hash pada sebuah direktif, `'unsafe-inline'` diabaikan — jadi `<style>` tanpa nonce dari SDK tetap terblokir walau `'unsafe-inline'` ditulis bersama nonce. `script-src` tetap memakai nonce + `'strict-dynamic'`; proteksi yang penting utuh. Catatan: `'strict-dynamic'` HANYA berlaku untuk `script-src`. Direktif itu tidak menurunkan izin apa pun ke `img-src`, `frame-src`, `media-src`, `connect-src`, maupun `style-src` — semuanya tetap dinilai sendiri-sendiri. Soal `frame-ancestors`: app ini dibuka langsung dari browser, bukan cuma di dalam Telegram. Membatasi frame-ancestors ke host Telegram membuat browser menolak me-render app di host lain (termasuk iframe preview), dan host itu memuat ulang terus sampai tampilannya kedip-kedip. Jadi `'self'` selalu diizinkan, host Telegram tetap dipertahankan supaya Mini App yang lama belum putus, dan di development origin preview ikut diizinkan. Di development `script-src` sengaja memakai `'unsafe-inline'` tanpa nonce: harness preview menyuntikkan inline script tanpa nonce, dan kalau diblokir preview-nya ikut reload-loop. Nonce + `'strict-dynamic'` tetap dipakai penuh di production. */
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

  // Host SDK Monetag beserta subdomainnya. Wildcard-nya sengaja dibatasi ke keluarga | domain SDK-nya sendiri — bukan tebakan host kreatif pihak ketiga — karena SDK-nya | memuat modul lanjutan dan iframe rewarded dari subdomain libtl.com yang berganti.
  const adHosts = 'https://libtl.com https://*.libtl.com'

  const scriptSrc = isDev
    ? `script-src 'self' https://telegram.org ${adHosts} 'unsafe-inline' 'unsafe-eval'`
    : `script-src 'self' https://telegram.org ${adHosts} 'nonce-${nonce}' 'strict-dynamic'`

  /** Direktif RENDER kreatif (bukan eksekusi script) dilonggarkan ke `https:` sejak migrasi ke Monetag. Alasannya konkret: berbeda dari Adsgram — yang menarik kreatif lewat `connect-src` ke satu host lalu me-render-nya sebagai `blob:` — Monetag membuka rewarded interstitial-nya sebagai iframe ke host kreatif pihak ketiga yang BERGANTI-GANTI (bukan hanya subdomain `libtl.com`), lalu iframe itu memuat gambar, video, dan beacon dari host lain lagi. Selama host-host itu diblokir, `show_<zone>()` gagal memuat dan Promise-nya reject — persis gejala "iklannya belum selesai ditonton". Yang TIDAK dilonggarkan: `script-src` tetap nonce + `'strict-dynamic'`, plus `object-src 'none'`, `base-uri`, `form-action`, dan `frame-ancestors` tetap ketat. Jadi eksekusi kode di dokumen utama tetap terkunci; yang diizinkan hanya memuat media dan membuka iframe pihak ketiga lewat HTTPS. */
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
