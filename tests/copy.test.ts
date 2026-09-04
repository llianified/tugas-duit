import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')

/** Permukaan yang dibaca PESERTA. Panel admin sengaja di luar: ia dipakai satu orang yang tahu persis apa itu `rate_limits`, dan di sana ketepatan istilah lebih berharga daripada keakraban. */
const SURFACE = [
  'features',
  'shell',
  'shared/components',
  'navigation',
  'server/messaging/notify.ts',
  'server/messaging/engagement.ts',
  'server/platform/http.ts',
  'domain/economy/withdrawal.ts',
]

const API_ROOT = 'app/api'

/** Kata yang tidak boleh sampai ke layar peserta, beserta gantinya. Bukan daftar gaya bahasa — daftar kata yang TIDAK DIMENGERTI orang yang aplikasinya dipakai: bapak-bapak dan emak-emak yang membuka Telegram buat nambah penghasilan, bukan orang yang pernah membaca dokumentasi HTTP. */
const TERLARANG: { pola: RegExp; ganti: string }[] = [
  { pola: /\bcooldown\b/i, ganti: 'jeda' },
  { pola: /\bclipboard\b/i, ganti: 'salin teks / kesalin' },
  { pola: /\btask\b/i, ganti: 'soal' },
  { pola: /\bsesi\b/i, ganti: 'sebut apa yang harus dilakukan, bukan namanya' },
  { pola: /\bAnda\b/, ganti: 'kamu' },
  { pola: /\b(silakan|harap|mohon)\b/i, ganti: 'kalimat perintah langsung' },
  { pola: /\btidak valid\b/i, ganti: 'nggak kebaca' },
  { pola: /\bkode:\s*[a-z]/i, ganti: 'buang kodenya, itu untuk log' },
]

/** Daftar kelas CSS: seluruh tokennya huruf kecil dan minimal satu di antaranya ber-tanda-hubung (`task-card active-task-card`). Kalimat copy tidak pernah berbentuk begitu. */
const CLASS_LIST = /^[a-z0-9]+(?:-[a-z0-9]+)+(?:\s+[a-z0-9[\]:./-]+)*$/

const CSS_ISH =
  /(^|\s)(flex|grid|absolute|relative|sticky|hidden|block|inline|truncate|shrink|grow|overflow|antialiased|tabular-nums|text-pretty)(\s|$)|-{0,1}\b(text|bg|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|w|h|min|max|rounded|border|font|leading|tracking|opacity|z|top|left|right|bottom|items|justify|col|row|space|ring|shadow|duration|ease|translate|scale)-/

const SOURCE_EXT = new Set(['.ts', '.tsx'])

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/** Kandidat copy: string berkutip yang berbentuk kalimat, plus teks JSX polos. Kelas CSS, path, dan nilai enum satu kata disaring keluar — semuanya tidak pernah dibaca siapa pun. */
function copyCandidates(source: string): string[] {
  const clean = stripComments(source)
  const out: string[] = []

  for (const match of clean.matchAll(/'([^'\n]{6,200})'|"([^"\n]{6,200})"|`([^`\n]{6,200})`/g)) {
    const text = match[1] ?? match[2] ?? match[3] ?? ''
    if (!/\s/.test(text)) continue
    if (!/[A-Za-z]{3}/.test(text)) continue
    if (CSS_ISH.test(text) || CLASS_LIST.test(text)) continue
    if (/^[@./]|^https?:|^[a-z-]+\/[a-z-]+/.test(text)) continue
    out.push(text)
  }

  for (const line of clean.split('\n')) {
    const text = line.trim()
    if (!/^[A-Z][^<>{}=]{15,200}$/.test(text)) continue
    if (!/[a-z]{3,}\s+[a-z]{3,}/.test(text)) continue
    out.push(text)
  }

  return out
}

async function sourceFiles(target: string): Promise<string[]> {
  const absolute = path.join(ROOT, target)
  const details = await stat(absolute)
  if (!details.isDirectory()) return [absolute]

  const entries = await readdir(absolute, { recursive: true })
  return entries
    .filter((entry) => SOURCE_EXT.has(path.extname(entry)) && !entry.includes('.test.'))
    .map((entry) => path.join(absolute, entry))
}

async function participantFiles(): Promise<string[]> {
  const nested = await Promise.all(SURFACE.map(sourceFiles))
  const api = (await readdir(path.join(ROOT, API_ROOT), { recursive: true }))
    .filter((entry) => entry.endsWith('route.ts') && !entry.startsWith('admin'))
    .map((entry) => path.join(ROOT, API_ROOT, entry))
  return [...nested.flat(), ...api]
}

describe('COPY-1 — tidak ada jargon di teks yang dibaca peserta', () => {
  /** Suara aplikasinya ditulis di `docs/keputusan-desain.md` bagian "Suara aplikasi". Test ini menjaga satu bagian yang bisa diperiksa mesin: kata-kata yang tidak boleh muncul. Sisanya — panjang kalimat, urutan kabar lalu penjelasan — tidak bisa diuji, dan memang tidak dicoba. */
  it('tidak menyisakan satu pun kata terlarang', async () => {
    const files = await participantFiles()
    expect(files.length).toBeGreaterThan(40)

    const temuan: string[] = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      for (const text of copyCandidates(source)) {
        for (const { pola, ganti } of TERLARANG) {
          if (pola.test(text)) {
            temuan.push(`${path.relative(ROOT, file)}: "${text}" → pakai ${ganti}`)
          }
        }
      }
    }

    expect(temuan).toEqual([])
  })
})
