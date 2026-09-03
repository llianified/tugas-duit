'use client'

/** INSTRUMENTASI SEMENTARA — dipasang hanya untuk membuktikan penyebab interstitial in-app ganda.
 *
 * Tidak mengubah arsitektur, tidak menahan tayangan, tidak menambah cooldown: probe ini
 * MEMBACA dan MENCATAT saja. Hapus file ini beserta pemanggilnya di `shell/app-shell.tsx`
 * begitu penyebabnya terbukti.
 *
 * Konstanta di bawah diambil dari SDK terpasang (`https://libtl.com/sdk.js`) setelah
 * de-obfuscation, bukan dari nama parameter atau dokumentasi:
 *
 * - `Xa = "ug4qk5tymo"` — kunci state in-app. SATU kunci global, BUKAN per zone. Isinya
 *   `"sessionStart/showCount/lastShow"`. Semua instance SDK di origin ini berbagi record ini.
 * - `Fo()` — untuk setiap `fakepushRelatedZones` bertipe `"in-app"` (dikonfigurasi di panel
 *   Monetag, tidak terlihat dari kode kita) SDK menyuntikkan `<script>` berisi SALINAN PENUH
 *   SDK dengan `dataset.sdk = "show_<zoneTerkait>"` dan `dataset.auto = "<freq/cap/interval/timeout/everyPage>"`.
 *   Sumbernya di-cache di `window.__vST`. Tiap salinan punya scope modul sendiri: `fu`
 *   (flag "sudah start"), `bf` (waktu init), dan poll loop 1000ms sendiri.
 * - `Df()` — kalau ada related zone in-app, penjadwal INDUK tidak jalan; seluruh tayangan
 *   diserahkan ke anak-anaknya.
 *
 * Karena itu yang dicatat: script SDK yang disuntikkan, jumlah global `show_*`, transisi
 * state bersama, semua pemanggil `show_*`, siklus hidup dokumen, dan asal overlay yang muncul. */

import { PRE_SDK_PROBE_GLOBAL } from '@/shell/pre-sdk-ads-probe'

const SHARED_STATE_KEY = 'ug4qk5tymo'
const POLL_MS = 1000
const MAX_ENTRIES = 600

interface ProbeEntry {
  at: string
  sinceStart: number
  /** `pre` = dicatat script inline sebelum SDK dimuat, `post` = dicatat probe React ini. */
  phase?: 'pre' | 'post'
  tag: string
  data?: unknown
}

/** Bentuk `window.__adProbePre` yang dipasang `shell/pre-sdk-ads-probe.ts`. Diketik lokal
 * karena yang menyediakannya adalah string inline, bukan modul yang bisa diimpor. */
interface PreSdkProbe {
  origin: number
  drain: () => ProbeEntry[]
  stop: () => void
}

function preSdkProbe(): PreSdkProbe | undefined {
  const candidate = (window as unknown as Record<string, unknown>)[PRE_SDK_PROBE_GLOBAL]
  if (!candidate || typeof candidate !== 'object') return undefined
  const probe = candidate as Partial<PreSdkProbe>
  return typeof probe.drain === 'function' && typeof probe.origin === 'number'
    ? (probe as PreSdkProbe)
    : undefined
}

interface AdState {
  storage: string
  key: string
  sessionStart: number
  showCount: number
  lastShow: number
}

const started = { value: false }
const entries: ProbeEntry[] = []
let startedAt = 0
let timer: ReturnType<typeof setInterval> | undefined
let observer: MutationObserver | undefined

function record(tag: string, data?: unknown): void {
  const now = Date.now()
  const entry: ProbeEntry = {
    at: new Date(now).toISOString(),
    sinceStart: startedAt ? now - startedAt : 0,
    phase: 'post',
    tag,
    ...(data === undefined ? {} : { data }),
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()
  console.log(`[v0][adprobe] +${entry.sinceStart}ms ${tag}`, data ?? '')
}

/** Menarik entri pre-hydration ke timeline ini. Dipanggil di awal `startInAppAdsProbe()`
 * dan lagi di setiap `dump()`, karena script inline masih bisa mencatat setelah probe
 * React hidup (poll dan MutationObserver-nya tetap jalan). Urutan dijaga dengan sort
 * pada `sinceStart` yang sudah memakai `origin` yang sama. */
function drainPreSdkEntries(): void {
  const probe = preSdkProbe()
  if (!probe) return
  let drained: ProbeEntry[] = []
  try {
    drained = probe.drain()
  } catch {
    return
  }
  if (drained.length === 0) return
  entries.push(...drained)
  entries.sort((left, right) => left.sinceStart - right.sinceStart)
  while (entries.length > MAX_ENTRIES) entries.shift()
}

/** `Le.read` menulis ke localStorage/indexedDB/sessionStorage saat `everyPage: false`, jadi
 * nilainya bertahan melewati reload. Kunci dicari dengan `includes` karena lapisan storage
 * SDK bisa menambah prefix. */
function readAdState(): AdState[] {
  const found: AdState[] = []
  const stores: Array<[string, Storage | undefined]> = [
    ['local', safeStorage(() => window.localStorage)],
    ['session', safeStorage(() => window.sessionStorage)],
  ]
  for (const [label, store] of stores) {
    if (!store) continue
    try {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i)
        if (!key || !key.includes(SHARED_STATE_KEY)) continue
        const raw = store.getItem(key) ?? ''
        const [sessionStart, showCount, lastShow] = raw
          .split('/')
          .map((part) => Number.parseInt(part || '', 10) || 0)
        found.push({
          storage: label,
          key,
          sessionStart: sessionStart ?? 0,
          showCount: showCount ?? 0,
          lastShow: lastShow ?? 0,
        })
      }
    } catch {
      // WebView Telegram dapat melempar saat storage dipartisi — abaikan, bukan bagian dari bukti.
    }
  }
  return found
}

function safeStorage(read: () => Storage): Storage | undefined {
  try {
    return read()
  } catch {
    return undefined
  }
}

/** Nama global `show_*` yang ada sekarang. Bertambahnya nama = ada instance SDK baru (jawaban C). */
function showGlobals(): string[] {
  const names: string[] = []
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!key.startsWith('show_')) continue
    if (typeof (window as unknown as Record<string, unknown>)[key] === 'function') names.push(key)
  }
  return names.sort()
}

const wrapped = new Set<string>()

/** Membungkus `show_<zone>` supaya SETIAP pemanggil tercatat: waktu, zone, params, dan stack.
 * Kalau fungsinya belum ada, pemasangannya lewat setter agar assignment SDK tertangkap. */
function watchShow(name: string): void {
  if (wrapped.has(name)) return
  const target = window as unknown as Record<string, unknown>

  const wrap = (original: unknown): unknown => {
    if (typeof original !== 'function') return original
    const fn = original as (...args: unknown[]) => unknown
    if ((fn as { __probed?: boolean }).__probed) return fn
    const proxy = function (this: unknown, ...args: unknown[]) {
      record('show() dipanggil', {
        sdk: name,
        params: safeClone(args[0]),
        showGlobals: showGlobals(),
        stack: callerStack(),
      })
      const result = fn.apply(this, args)
      if (result instanceof Promise) {
        result.then(
          () => record('show() resolve', { sdk: name, state: readAdState() }),
          (error: unknown) => record('show() reject', { sdk: name, reason: String(error) }),
        )
      }
      return result
    }
    Object.defineProperty(proxy, '__probed', { value: true })
    return proxy
  }

  const existing = target[name]
  if (typeof existing === 'function') {
    // Probe pre-SDK sudah membungkusnya. Menulis ulang di sini hanya memicu setter-nya
    // dan menambah entri palsu ke timeline, jadi cukup diakui.
    if ((existing as { __probed?: boolean }).__probed) {
      wrapped.add(name)
      record('show() sudah dibungkus probe pre-SDK', { sdk: name })
      return
    }
    target[name] = wrap(existing)
    wrapped.add(name)
    record('show() dibungkus (sudah ada)', { sdk: name })
    return
  }

  let stored: unknown
  try {
    Object.defineProperty(window, name, {
      configurable: true,
      enumerable: true,
      get: () => stored,
      set: (value: unknown) => {
        stored = wrap(value)
        record('show() didefinisikan oleh SDK', { sdk: name })
      },
    })
    wrapped.add(name)
  } catch {
    // Properti tidak bisa diredefinisi — biarkan, poll `showGlobals()` masih mencatat kemunculannya.
  }
}

function callerStack(): string[] {
  const raw = new Error('probe').stack ?? ''
  return raw
    .split('\n')
    .slice(2, 8)
    .map((line) => line.trim())
    .filter(Boolean)
}

function safeClone(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function describeNode(node: Element): Record<string, unknown> {
  const src =
    node.getAttribute('src') ?? node.getAttribute('data-src') ?? node.getAttribute('href') ?? ''
  let host = ''
  try {
    if (src) host = new URL(src, window.location.href).host
  } catch {
    host = ''
  }
  return {
    tag: node.tagName,
    id: node.id || undefined,
    className: typeof node.className === 'string' ? node.className || undefined : undefined,
    src: src || undefined,
    host: host || undefined,
    // Atribusi jaringan — inilah yang memisahkan Monetag in-app dari rewarded OnClicka (jawaban D).
    network: host.includes('libtl')
      ? 'monetag'
      : host.includes('onclck') || host.includes('onclickalgo')
        ? 'onclicka'
        : undefined,
  }
}

/** Overlay layar penuh: dipakai untuk memastikan iklan KEDUA benar-benar Monetag in-app
 * dan bukan rewarded OnClicka yang jalur gate-nya terpisah. */
function looksFullScreen(node: Element): boolean {
  try {
    const style = window.getComputedStyle(node)
    if (style.position !== 'fixed' && style.position !== 'absolute') return false
    const rect = node.getBoundingClientRect()
    const viewport = window.innerWidth * window.innerHeight
    if (viewport <= 0) return false
    return rect.width * rect.height >= viewport * 0.5
  } catch {
    return false
  }
}

export function startInAppAdsProbe(): void {
  if (typeof window === 'undefined' || started.value) return
  started.value = true

  /** Titik nol diambil dari probe pre-SDK kalau ada, supaya `sinceStart` kedua fase bisa
   * dibandingkan langsung dan "SDK mendefinisikan `show_*`" vs "`useInAppAds` mendaftar"
   * terbaca sebagai satu urutan. Tanpa probe inline, perilakunya seperti sebelumnya. */
  const pre = preSdkProbe()
  startedAt = pre?.origin ?? Date.now()
  drainPreSdkEntries()

  const navigation = (
    performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  )[0]

  record('probe React start (post-hydration)', {
    preSdkProbeTerpasang: Boolean(pre),
    msSejakPreSdkProbe: pre ? Date.now() - pre.origin : null,
  })

  record('probe start', {
    url: window.location.href,
    // "reload" di sini menjawab apakah window baru datang dari dokumen yang dimuat ulang.
    navigationType: navigation?.type ?? 'unknown',
    sdkScripts: Array.from(document.querySelectorAll('script[data-sdk], script[data-zone]')).map(
      (node) => ({
        ...describeNode(node),
        dataSdk: node.getAttribute('data-sdk') ?? undefined,
        dataZone: node.getAttribute('data-zone') ?? undefined,
        // `data-auto` ada = SDK memakai jadwal dari atribut ini dan MENGABAIKAN `inAppSettings` kita.
        dataAuto: node.getAttribute('data-auto') ?? undefined,
      }),
    ),
    showGlobals: showGlobals(),
    sharedState: readAdState(),
    relatedZoneSdkCached: Boolean((window as unknown as Record<string, unknown>).__vST),
  })

  const zoneId = process.env.NEXT_PUBLIC_MONETAG_ZONE_ID?.trim()
  if (zoneId) watchShow(`show_${zoneId}`)
  for (const name of showGlobals()) watchShow(name)

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (!(node instanceof Element)) continue
        if (node.tagName === 'SCRIPT') {
          const dataSdk = node.getAttribute('data-sdk')
          const dataAuto = node.getAttribute('data-auto')
          // Inilah tanda tangan `Fo()`: salinan SDK kedua untuk related zone in-app.
          if (dataSdk || dataAuto) {
            record('SDK instance BARU disuntikkan', {
              ...describeNode(node),
              dataSdk: dataSdk ?? undefined,
              dataAuto: dataAuto ?? undefined,
              inline: !node.getAttribute('src'),
              showGlobalsSebelum: showGlobals(),
            })
            if (dataSdk) watchShow(dataSdk)
          }
          continue
        }
        if (node.tagName === 'IFRAME' || looksFullScreen(node)) {
          record('overlay/iframe muncul', {
            ...describeNode(node),
            sharedState: readAdState(),
          })
        }
      }
    }
  })
  observer.observe(document.documentElement, { childList: true, subtree: true })

  let previousState = JSON.stringify(readAdState())
  let previousGlobals = showGlobals().join(',')

  timer = setInterval(() => {
    const state = readAdState()
    const serialized = JSON.stringify(state)
    if (serialized !== previousState) {
      previousState = serialized
      const now = Date.now()
      record('state capping berubah', {
        state,
        // Turunan yang menjawab langsung apakah capping bekerja seperti dugaan.
        umurWindowDetik: state.map((item) =>
          item.sessionStart ? Math.round((now - item.sessionStart) / 1000) : null,
        ),
        sejakTayangTerakhirDetik: state.map((item) =>
          item.lastShow ? Math.round((now - item.lastShow) / 1000) : null,
        ),
      })
    }
    const globals = showGlobals().join(',')
    if (globals !== previousGlobals) {
      previousGlobals = globals
      record('daftar global show_* berubah', { showGlobals: globals.split(',') })
      for (const name of globals.split(',')) watchShow(name)
    }
  }, POLL_MS)

  window.addEventListener('pageshow', (event) => {
    record('pageshow', {
      dariBfcache: (event as PageTransitionEvent).persisted,
      sharedState: readAdState(),
    })
  })
  window.addEventListener('pagehide', (event) => {
    record('pagehide', { persisted: (event as PageTransitionEvent).persisted })
  })
  document.addEventListener('visibilitychange', () => {
    record('visibilitychange', { state: document.visibilityState })
  })

  ;(window as unknown as Record<string, unknown>).__adProbe = {
    /** Timeline gabungan: entri pre-SDK diserap dulu supaya apa pun yang dicatat script
     * inline setelah hydration tetap ikut, lalu seluruhnya dikembalikan terurut. */
    dump: () => {
      drainPreSdkEntries()
      return entries
    },
    /** Dipakai `useInAppAds` untuk menandai kapan panggilan eksplisit terjadi (atau dilewati). */
    record,
    state: readAdState,
    showGlobals,
    stop: stopInAppAdsProbe,
  }
}

export function stopInAppAdsProbe(): void {
  clearInterval(timer)
  observer?.disconnect()
  // Poll dan observer script inline berjalan terpisah, jadi ikut dihentikan — kalau tidak,
  // "stop" hanya membungkam separuh instrumentasi.
  try {
    preSdkProbe()?.stop()
  } catch {
    // Tidak ada yang bisa dilakukan; probe memang sedang dimatikan.
  }
  started.value = false
}
