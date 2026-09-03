import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist, Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'
import { GIGAPUB_PROJECT_ID, MONETAG_DEFAULT_ZONE_ID, monetagSdkName } from '@/domain/ads/ads'
import { ADS_HINT_INIT_SCRIPT } from '@/shell/ads-hint'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

// Font display (heading + angka). Body tetap tumpukan sistem lewat `--font-sans`.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
  variable: '--font-plus-jakarta',
})

export const metadata: Metadata = {
  title: 'Tugas Duit',
  description: 'Kerjakan soal, kumpulkan credit, lalu tarik jadi Rupiah.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  // Gelap-saja: tidak ada toggle dan tidak ada varian terang, jadi `colorScheme` | dikunci supaya kontrol bawaan browser (scrollbar, form) ikut gelap.
  colorScheme: 'dark',
  themeColor: '#101014',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  // Zone Monetag hanya dipakai interstitial otomatis in-app. Rewarded/tiket memakai project Giga.pub yang dimuat terpisah di bawah.
  const monetagZoneId = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID

  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${plusJakartaSans.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ADS_HINT_INIT_SCRIPT }} />
      </head>
      <body className="antialiased font-sans">
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
        <Script
          src="https://libtl.com/sdk.js"
          strategy="afterInteractive"
          nonce={nonce}
          data-zone={monetagZoneId}
          data-sdk={monetagSdkName(monetagZoneId)}
        />
        <Script
          src={`https://ad.gigapub.tech/script?id=${GIGAPUB_PROJECT_ID}`}
          strategy="afterInteractive"
          nonce={nonce}
        />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
        <SpeedInsights />
      </body>
    </html>
  )
}
