import { env } from './env'

const REQUEST_TIMEOUT_MS = 15_000
const DEFAULT_EXPIRY_MINUTES = 60

export class KlikqrisError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'KlikqrisError'
    this.code = code
  }
}

export function klikqrisConfigured(): boolean {
  return env.klikqrisApiKeyOrNull !== null && env.klikqrisMerchantIdOrNull !== null
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': env.klikqrisApiKey,
    id_merchant: env.klikqrisMerchantId,
  }
}

const toAmount = (value: unknown): number => {
  const parsed = Math.round(Number(value))
  return Number.isFinite(parsed) ? parsed : 0
}

const toText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

interface GatewayEnvelope {
  status?: boolean
  message?: string
  data?: Record<string, unknown>
}

async function call(path: string, init: RequestInit): Promise<GatewayEnvelope> {
  let response: Response
  try {
    response = await fetch(`${env.klikqrisBaseUrl}${path}`, {
      ...init,
      headers: headers(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new KlikqrisError('GATEWAY_UNREACHABLE', 'Gateway pembayaran tidak bisa dihubungi')
  }

  const body = (await response.json().catch(() => null)) as GatewayEnvelope | null
  if (!response.ok || !body || body.status !== true || !body.data) {
    throw new KlikqrisError(
      'GATEWAY_REFUSED',
      `Gateway menolak permintaan (${response.status}): ${body?.message ?? 'tanpa pesan'}`,
    )
  }
  return body
}

export interface CreatedInvoice {
  orderId: string
  amountIdr: number
  totalAmountIdr: number
  signature: string
  qrisUrl: string | null
  qrisImage: string | null
  expiresAt: Date
}

/** `expired_at` dari gateway datang tanpa zona waktu, jadi tidak dipakai sebagai jam dinding. Yang dipakai `expired_menit` dihitung dari sekarang — sedikit lebih pendek kalau jam kedua server bergeser, dan itu arah yang aman. */
export async function createInvoice(input: {
  orderId: string
  amountIdr: number
  keterangan: string
  callbackUrl: string
}): Promise<CreatedInvoice> {
  const body = await call('/qris/create', {
    method: 'POST',
    body: JSON.stringify({
      order_id: input.orderId,
      id_merchant: env.klikqrisMerchantId,
      amount: input.amountIdr,
      keterangan: input.keterangan,
      callback_url: input.callbackUrl,
    }),
  })

  const data = body.data as Record<string, unknown>
  const signature = toText(data.signature)
  if (!signature) {
    throw new KlikqrisError('GATEWAY_NO_SIGNATURE', 'Gateway tidak mengirim signature')
  }

  const minutes = Number(data.expired_menit)
  const expiryMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_EXPIRY_MINUTES
  const totalAmountIdr = toAmount(data.total_amount) || input.amountIdr

  return {
    orderId: toText(data.order_id) ?? input.orderId,
    amountIdr: toAmount(data.amount) || input.amountIdr,
    totalAmountIdr,
    signature,
    qrisUrl: toText(data.qris_url),
    qrisImage: toText(data.qris_image),
    expiresAt: new Date(Date.now() + expiryMinutes * 60_000),
  }
}

export type GatewayStatus = 'PENDING' | 'SUCCESS' | 'EXPIRED' | 'UNKNOWN'

export function normalizeStatus(value: unknown): GatewayStatus {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (raw === 'PAID' || raw === 'SUCCESS') return 'SUCCESS'
  if (raw === 'PENDING') return 'PENDING'
  if (raw === 'EXPIRED') return 'EXPIRED'
  return 'UNKNOWN'
}

export interface InvoiceStatus {
  orderId: string
  status: GatewayStatus
  signature: string | null
  totalAmountIdr: number
}

export async function readInvoiceStatus(orderId: string): Promise<InvoiceStatus> {
  const body = await call(`/qris/status/${encodeURIComponent(orderId)}`, { method: 'GET' })
  const data = body.data as Record<string, unknown>
  return {
    orderId: toText(data.order_id) ?? orderId,
    status: normalizeStatus(data.status),
    signature: toText(data.signature),
    totalAmountIdr: toAmount(data.total_amount),
  }
}
