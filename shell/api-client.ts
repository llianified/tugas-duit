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

export const NETWORK_ERROR_MESSAGE = 'Koneksinya putus. Cek internet kamu terus coba lagi ya.'

export function userFacingMessage(error: unknown, fallback = NETWORK_ERROR_MESSAGE): string {
  return error instanceof ApiError ? error.message : fallback
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  return readJson<T>(response)
}

export async function sendJson<T>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return readJson<T>(response)
}

export async function sendFormData<T>(
  url: string,
  method: 'POST' | 'PATCH',
  form: FormData,
): Promise<T> {
  const response = await fetch(url, { method, body: form })
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
