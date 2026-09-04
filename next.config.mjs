const nextConfig = {
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ['@electric-sql/pglite'],
  /** PGlite hanya dipakai jalur preview (`isPreviewDb()`, mustahil true saat `NODE_ENV=production`), tapi file tracer ikut menyalin ~20 MB wasm+data-nya ke tiap fungsi yang menyentuh `server/platform/db.ts` — 44 fungsi, ~880 MB per deploy, dan Function Storage Vercel menjumlahkannya lintas deploy. */
  outputFileTracingExcludes: { '**/*': ['**/@electric-sql/pglite/**'] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/tugasduit-wordmark-light.68e0c561.png',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
