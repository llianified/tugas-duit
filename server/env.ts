// Pakai path relatif ke modul daun, BUKAN alias '@/domain/ads'. File ini ikut dimuat
// script di `scripts/` yang dijalankan Node langsung (--experimental-strip-types), dan
// Node tidak mengerti alias `@/...` dari tsconfig — lihat catatan di monetag-zone.ts.
import { MONETAG_DEFAULT_ZONE_ID } from '../domain/monetag-zone.ts'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Env var ${name} belum diset`)
  return value
}

export const env = {
  get databaseUrl() { return required('DATABASE_URL') },
  /**
   * Migrasi memakai `pg_advisory_lock`, yaitu lock tingkat SESI. Connection pooler Neon
   * berjalan di mode transaksi: koneksi yang sama bisa berpindah pemilik di antara dua
   * transaksi, sehingga lock-nya bisa dibuka oleh sesi lain atau tidak terbuka sama
   * sekali. Jadi migrasi wajib lewat endpoint langsung (tanpa `-pooler`), sementara
   * runtime app justru harus lewat yang pooled. Integrasi Neon–Vercel mengisi
   * DATABASE_URL_UNPOOLED sendiri; kalau tidak ada, jatuh ke DATABASE_URL.
   */
  get databaseUrlForMigrations() {
    return process.env.DATABASE_URL_UNPOOLED?.trim() || required('DATABASE_URL')
  },
  get cronSecretOrNull() { return process.env.CRON_SECRET?.trim() || null },
  get botToken() { return required('TELEGRAM_BOT_TOKEN') },
  get botUsername() { return required('TELEGRAM_BOT_USERNAME') },
  get botUsernameOrNull() { return process.env.TELEGRAM_BOT_USERNAME ?? null },
  get webhookSecret() { return required('TELEGRAM_WEBHOOK_SECRET') },
  get appOrigin() { return required('APP_ORIGIN') },
  get appOriginOrNull() { return process.env.APP_ORIGIN ?? null },
  get adminPasswordOrNull() { return process.env.ADMIN_PASSWORD || null },
  get adminTelegramIdOrNull() { return process.env.ADMIN_TELEGRAM_ID?.trim() || null },
  /**
   * Zone Monetag. Tidak pernah null: kalau env-nya kosong, dipakai zone default dari
   * `domain/ads.ts` supaya iklan tetap jalan tanpa env tambahan. Mematikan fitur
   * iklannya lewat panel admin (`adsMaxViewsPerDay=0`), bukan lewat env ini.
   */
  get monetagZoneId() {
    return process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim() || MONETAG_DEFAULT_ZONE_ID
  },
  get klikqrisApiKey() { return required('KLIKQRIS_API_KEY') },
  get klikqrisApiKeyOrNull() { return process.env.KLIKQRIS_API_KEY?.trim() || null },
  get klikqrisMerchantId() { return required('KLIKQRIS_MERCHANT_ID') },
  get klikqrisMerchantIdOrNull() { return process.env.KLIKQRIS_MERCHANT_ID?.trim() || null },
  get klikqrisBaseUrl() {
    return process.env.KLIKQRIS_BASE_URL?.trim() || 'https://klikqris.com/api'
  },
  get telegramChannelId() {
    return process.env.TELEGRAM_CHANNEL_ID?.trim() || '@tugasduit'
  },
  get telegramChannelUrl() {
    return process.env.TELEGRAM_CHANNEL_URL?.trim() || 'https://t.me/tugasduit'
  },
}
