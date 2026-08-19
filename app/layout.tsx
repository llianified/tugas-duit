import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist } from 'next/font/google'
import Script from 'next/script'
import { THEME_INIT_SCRIPT } from '@/shell/theme-init'
import './globals.css'

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

export const metadata: Metadata = {
  title: 'Tugas Duit',
  description: 'Task CAPTCHA berhadiah credit, dengan riwayat task dan program referral.',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#101014' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const adsgramEnabled = Boolean(process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID)

  return (
    <html lang="id" className={`${geistSans.variable} bg-background`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased font-sans">
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
          nonce={nonce}
        />
        {adsgramEnabled && (
          <Script src="https://sad.adsgram.ai/js/sad.min.js" strategy="lazyOnload" nonce={nonce} />
        )}
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
