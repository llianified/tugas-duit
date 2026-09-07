export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ErrorPayload = { error?: { code?: string; message?: string } }

export const NETWORK_ERROR_MESSAGE = 'Koneksi putus. Cek internet, lalu coba lagi.'

export function userFacingMessage(error: unknown, fallback = NETWORK_ERROR_MESSAGE): string {
  return error instanceof ApiError ? error.message : fallback
}

/** Pembawa sesi cadangan untuk PREVIEW saja. Preview lintas-situs dan Telegram Web sama-sama membingkai app ini dari situs lain, jadi cookie sesinya adalah cookie pihak ketiga. `Partitioned` menyelamatkannya di Chrome modern, tapi Safari/Firefox dan setelan "blokir cookie pihak ketiga" tetap membuangnya tanpa suara — dan gejalanya hanya "Kami belum kenal sesi kamu" yang mustahil dilewati. Header tidak lewat cookie jar sama sekali, jadi ia lolos dari semua aturan itu. Nilainya hanya pernah ada di preview: `/api/dev/login` 404 di produksi, dan `previewSessionToken` di server mengembalikan null di luar preview. Di produksi variabel ini tetap null dan header-nya tidak pernah terkirim. Ditaruh di memori modul, bukan `localStorage`: umurnya cukup selama tab hidup, dan token sesi tidak perlu ditulis ke storage yang bisa dibaca skrip lain. */
let previewSessionToken: string | null = null

export function setPreviewSessionToken(token: string | null): void {
  previewSessionToken = token
}

function authHeaders(base?: Record<string, string>): Record<string, string> | undefined {
  if (!previewSessionToken) return base
  return { ...base, 'x-td-session': previewSessionToken }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: authHeaders({ accept: 'application/json' }) })
  return readJson<T>(response)
}

export async function sendJson<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: authHeaders(body === undefined ? undefined : { 'content-type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return readJson<T>(response)
}

export async function sendFormData<T>(
  url: string,
  method: 'POST' | 'PATCH',
  form: FormData,
): Promise<T> {
  // Sengaja tanpa `content-type`: fetch harus menyusunnya sendiri beserta boundary.
  const response = await fetch(url, { method, body: form, headers: authHeaders() })
  return readJson<T>(response)
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  const payload = (await response.json().catch(() => null)) as ErrorPayload | null
  throw new ApiError(
    payload?.error?.message ?? 'Lagi ada gangguan. Coba lagi ya.',
    payload?.error?.code ?? 'INTERNAL',
    response.status,
  )
}
