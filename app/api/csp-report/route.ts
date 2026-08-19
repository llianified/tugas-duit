
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024

const LOG_LIMIT_PER_WINDOW = 50
const LOG_WINDOW_MS = 60_000

let windowStartedAt = 0
let loggedInWindow = 0

function shouldLog(): boolean {
  const now = Date.now()
  if (now - windowStartedAt > LOG_WINDOW_MS) {
    windowStartedAt = now
    loggedInWindow = 0
  }
  loggedInWindow += 1
  if (loggedInWindow === LOG_LIMIT_PER_WINDOW + 1) {
    console.warn(
      `[csp] lebih dari ${LOG_LIMIT_PER_WINDOW} laporan dalam ${LOG_WINDOW_MS / 1000}s, sisanya tidak dicatat`,
    )
  }
  return loggedInWindow <= LOG_LIMIT_PER_WINDOW
}

interface Violation {
  directive: string
  blockedUri: string
  documentUri: string
  sample: string
}

const UNKNOWN = '(tidak disebutkan)'

function truncate(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 200) : UNKNOWN
}

function normalize(payload: unknown): Violation[] {
  const entries = Array.isArray(payload) ? payload : [payload]

  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const nested = (record['csp-report'] ?? record.body ?? record) as Record<string, unknown>
    if (!nested || typeof nested !== 'object') return []

    const directive = nested['effectiveDirective'] ?? nested['effective-directive'] ?? nested['violated-directive']
    const blockedUri = nested['blockedURL'] ?? nested['blocked-uri']
    const documentUri = nested['documentURL'] ?? nested['document-uri']
    const sample = nested['sample'] ?? nested['script-sample']

    if (directive === undefined && blockedUri === undefined) return []

    return [
      {
        directive: truncate(directive),
        blockedUri: truncate(blockedUri),
        documentUri: truncate(documentUri),
        sample: truncate(sample),
      },
    ]
  })
}

export async function POST(request: Request) {
  const noContent = new Response(null, { status: 204 })

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_BODY_BYTES) return noContent

  let payload: unknown
  try {
    const text = await request.text()
    if (text.length === 0 || text.length > MAX_BODY_BYTES) return noContent
    payload = JSON.parse(text)
  } catch {
    return noContent
  }

  for (const violation of normalize(payload)) {
    if (!shouldLog()) break
    console.warn(
      `[csp] pelanggaran ${violation.directive} · diblokir ${violation.blockedUri} · di ${violation.documentUri} · cuplikan ${violation.sample}`,
    )
  }

  return noContent
}
