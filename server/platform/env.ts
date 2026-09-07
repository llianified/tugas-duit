function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Env var ${name} belum diset`)
  return value
}

export const env = {
  get databaseUrl() { return required('DATABASE_URL') },
  /** Migrasi memakai `pg_advisory_lock`, yaitu lock tingkat SESI. Connection pooler Neon berjalan di mode transaksi: koneksi yang sama bisa berpindah pemilik di antara dua transaksi, sehingga lock-nya bisa dibuka oleh sesi lain atau tidak terbuka sama sekali. Jadi migrasi wajib lewat endpoint langsung (tanpa `-pooler`), sementara runtime app justru harus lewat yang pooled. Render mengisi DATABASE_URL_UNPOOLED secara eksplisit; pemakaian manual boleh jatuh ke DATABASE_URL. */
  get databaseUrlForMigrations() {
    return process.env.DATABASE_URL_UNPOOLED?.trim() || required('DATABASE_URL')
  },
  get cronSecretOrNull() { return process.env.CRON_SECRET?.trim() || null },
  get botToken() { return required('TELEGRAM_BOT_TOKEN') },
  get botTokenOrNull() { return process.env.TELEGRAM_BOT_TOKEN?.trim() || null },
  get botUsername() { return required('TELEGRAM_BOT_USERNAME') },
  get botUsernameOrNull() { return process.env.TELEGRAM_BOT_USERNAME ?? null },
  get webhookSecret() { return required('TELEGRAM_WEBHOOK_SECRET') },
  /** Bentuk yang tidak melempar, dipakai webhook Telegram. Membaca `webhookSecret` di sana berarti env yang belum diset menjadi 500 bertumpuk — Telegram mengulang kirim untuk 5xx — padahal jawaban yang benar adalah menolak dengan 401 seperti `CRON_SECRET` di `app/api/cron/maintenance`. */
  get webhookSecretOrNull() { return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null },
  get appOrigin() { return required('APP_ORIGIN') },
  get appOriginOrNull() { return process.env.APP_ORIGIN ?? null },
  get adminPasswordOrNull() { return process.env.ADMIN_PASSWORD || null },
  get adminTelegramIdOrNull() { return process.env.ADMIN_TELEGRAM_ID?.trim() || null },
  get klikqrisApiKey() { return required('KLIKQRIS_API_KEY') },
  get klikqrisApiKeyOrNull() { return process.env.KLIKQRIS_API_KEY?.trim() || null },
  get klikqrisMerchantId() { return required('KLIKQRIS_MERCHANT_ID') },
  get klikqrisMerchantIdOrNull() { return process.env.KLIKQRIS_MERCHANT_ID?.trim() || null },
  get klikqrisBaseUrl() {
    return process.env.KLIKQRIS_BASE_URL?.trim() || 'https://klikqris.com/api'
  },
  /** Rahasia postback Monetag. Ikut di query URL karena postback berupa GET tanpa header (lihat `app/api/ads/postback/route.ts`). Kalau kosong, route-nya menolak SEMUA pemanggil (503) — verifikasi mati, bukan terbuka untuk siapa saja. */
  get monetagPostbackSecretOrNull() { return process.env.MONETAG_POSTBACK_SECRET?.trim() || null },
  get telegramChannelId() {
    return process.env.TELEGRAM_CHANNEL_ID?.trim() || '@tugasduit'
  },
  get telegramChannelUrl() {
    return process.env.TELEGRAM_CHANNEL_URL?.trim() || 'https://t.me/tugasduit'
  },
}
