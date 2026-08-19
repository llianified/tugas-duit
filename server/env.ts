function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Env var ${name} belum diset`)
  return value
}

export const env = {
  get databaseUrl() { return required('DATABASE_URL') },
  get botToken() { return required('TELEGRAM_BOT_TOKEN') },
  get botUsername() { return required('TELEGRAM_BOT_USERNAME') },
  get botUsernameOrNull() { return process.env.TELEGRAM_BOT_USERNAME ?? null },
  get webhookSecret() { return required('TELEGRAM_WEBHOOK_SECRET') },
  get appOrigin() { return required('APP_ORIGIN') },
  get appOriginOrNull() { return process.env.APP_ORIGIN ?? null },
  get adminPasswordOrNull() { return process.env.ADMIN_PASSWORD || null },
  get adminTelegramIdOrNull() { return process.env.ADMIN_TELEGRAM_ID?.trim() || null },
  get adsgramBlockIdOrNull() { return process.env.NEXT_PUBLIC_ADSGRAM_BLOCK_ID?.trim() || null },
  get adsgramDebug() { return process.env.NEXT_PUBLIC_ADSGRAM_DEBUG === 'true' },
}
