import { query } from './db'

export interface RateLimitVerdict {
  allowed: boolean
  retryAfter: number
}

interface Lease {
  /** Akhir window versi jam Postgres, bukan jam Node. */
  windowEndMs: number
  remaining: number
  blocked: boolean
}

/** Token yang belum terpakai dibuang 2 detik sebelum window benar-benar berakhir. Selisih jam antara Node dan Postgres selalu ada, dan tanpa jaga-jaga ini token dari window lama bisa ikut dibelanjakan di window berikutnya — satu-satunya arah kesalahan yang tidak boleh terjadi. Di dalam rentang ini reservasi dimatikan sama sekali dan request dilayani jalur eksak: memesan lease baru di sini hanya melahirkan lease yang langsung kena guard-nya sendiri, jadi tokennya hangus tanpa pernah terpakai dan request berputar sampai `MAX_ACQUIRE_ATTEMPTS`. */
const LEASE_GUARD_MS = 2_000

/** Di bawah plafon ini reservasi tidak dipakai sama sekali: bucket kecil justru yang paling sensitif (`withdraw` 5/jam, `premium:checkout` 10/600s, `admin:maintenance` 6/jam, `task:submit` 30/60s) dan penghematannya paling tidak berarti karena volumenya memang kecil. */
const LEASE_MIN_LIMIT = 60

/** Tidak lebih dari 10 token sekaligus, berapa pun plafonnya. Token yang hangus saat instance mati atau window berganti dibatasi angka ini, jadi selisih antara plafon nominal dan plafon efektif tetap kecil. */
const LEASE_MAX = 10

/** Pembagi plafon: 5% plafon per reservasi, artinya paling banyak ~20 write per window per bucket per instance. */
const LEASE_DIVISOR = 20

/** Atap jumlah bucket yang di-cache satu instance. Bucket-nya per user (`activity:${user.id}`), jadi tanpa atap ini Map-nya tumbuh seiring jumlah user yang pernah dilayani instance tersebut. */
const MAX_LEASES = 5_000

/** Kalau token yang baru dipesan terus disalip request lain di instance yang sama, berhenti berputar dan jatuh ke jalur eksak satu token. Batas ini hanya jaring pengaman: bucket produksi dikunci per user, jadi konkurensi per bucket praktis 1–2. */
const MAX_ACQUIRE_ATTEMPTS = 8

const leases = new Map<string, Lease>()
const inflight = new Map<string, Promise<void>>()

function leaseSize(limit: number): number {
  if (limit < LEASE_MIN_LIMIT) return 1
  return Math.min(LEASE_MAX, Math.max(1, Math.floor(limit / LEASE_DIVISOR)))
}

function windowEnd(windowEpoch: number, windowSeconds: number): number {
  return (windowEpoch + windowSeconds) * 1_000
}

function retryAfterFrom(windowEndMs: number, now: number): number {
  return Math.max(1, Math.ceil((windowEndMs - now) / 1_000))
}

/** Sisa window menurut jam Node, dipakai saat belum ada lease sama sekali sehingga batas versi Postgres belum diketahui. Batas window-nya kelipatan `windowSeconds` sejak epoch — rumus yang sama dengan `floor(extract(epoch from now())/$2)*$2` di Postgres — jadi keduanya hanya berbeda sebesar selisih jam. Angka ini cuma memilih jalur, tidak pernah memutuskan lolos atau tidak, jadi salah tebak paling jauh berarti request memakai jalur eksak yang selalu benar. */
function windowRemainingMs(windowSeconds: number, now: number): number {
  const span = windowSeconds * 1_000
  return span - (now % span)
}

/** Di ekor window jangan pesan lease: pakai jalur eksak. */
function inLeaseGuard(windowSeconds: number, now: number): boolean {
  return windowRemainingMs(windowSeconds, now) <= LEASE_GUARD_MS
}

/** Satu pernyataan atomik, dan tetap satu-satunya sumber kebenaran. `$3` token dibayar di muka sekaligus, jadi dua instance tidak pernah bisa memesan rentang token yang sama. `window_start` dihitung jam Postgres lalu dikembalikan supaya cache lokal memakai batas window versi database, bukan versi `Date.now()`. */
async function reserveInDb(bucket: string, windowSeconds: number, size: number) {
  const rows = await query<{ count: number; window_epoch: string | number }>(
    `insert into rate_limits(bucket,window_start,count)
     values($1,to_timestamp(floor(extract(epoch from now())/$2)*$2),$3::int)
     on conflict(bucket,window_start) do update set count=rate_limits.count+$3::int
     returning count, extract(epoch from window_start)::bigint as window_epoch`,
    [bucket, windowSeconds, size],
  )
  return { count: Number(rows[0].count), windowEpoch: Number(rows[0].window_epoch) }
}

function pruneLeases(): void {
  const now = Date.now()
  for (const [key, lease] of leases) {
    if (now >= lease.windowEndMs) leases.delete(key)
  }
  if (leases.size < MAX_LEASES) return
  /** Masih penuh setelah entri kedaluwarsa dibuang: lepas separuh tertua (Map menjaga urutan penyisipan). Entri yang dilepas hanya menghanguskan token sisanya — request berikutnya memesan ulang dari database, jadi arahnya lebih ketat, bukan lebih longgar. */
  const excess = leases.size - Math.floor(MAX_LEASES / 2)
  let dropped = 0
  for (const key of leases.keys()) {
    if (dropped++ >= excess) break
    leases.delete(key)
  }
}

function setLease(key: string, lease: Lease): void {
  if (!leases.has(key) && leases.size >= MAX_LEASES) pruneLeases()
  leases.set(key, lease)
}

/** Ambil satu token dari lease yang sudah dibayar. `null` berarti "belum punya hak, pesan dulu" dan `'guard'` berarti "jangan pesan, window hampir habis" — keduanya bukan "boleh". */
function takeFromLease(key: string): RateLimitVerdict | 'guard' | null {
  const lease = leases.get(key)
  if (!lease) return null

  const now = Date.now()
  /** Batas versi Postgres, jadi ini yang menentukan — bukan tebakan `windowRemainingMs`. */
  if (now >= lease.windowEndMs - LEASE_GUARD_MS) {
    leases.delete(key)
    return 'guard'
  }

  const retryAfter = retryAfterFrom(lease.windowEndMs, now)
  /** Klien yang sudah tertolak tidak menulis apa pun lagi sampai window berganti. Sebelumnya justru sebaliknya: setiap request yang dijawab 429 tetap membayar satu write, jadi penyalahgunaan paling kasar yang paling banyak membebani database. */
  if (lease.blocked) return { allowed: false, retryAfter }
  if (lease.remaining > 0) {
    lease.remaining -= 1
    return { allowed: true, retryAfter }
  }
  return null
}

/** Satu reservasi per key meski banyak request datang bersamaan. Yang di-dedupe adalah pemesanannya, bukan jawabannya: tiap penunggu tetap mengambil token sendiri dari lease sesudahnya, sehingga satu token tidak pernah dipakai dua request. */
async function reserveTokens(
  key: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const pending = inflight.get(key)
  if (pending) return pending

  const run = (async () => {
    try {
      const size = leaseSize(limit)
      const { count, windowEpoch } = await reserveInDb(bucket, windowSeconds, size)
      /** Token yang kita pegang adalah nomor `count-size+1 … count`; yang sah hanya yang `<= limit`. Selisihnya bisa negatif kalau window sudah penuh — itulah kondisi terblokir. */
      const usable = Math.min(size, limit - (count - size))
      setLease(key, {
        windowEndMs: windowEnd(windowEpoch, windowSeconds),
        remaining: Math.max(0, usable),
        blocked: usable <= 0,
      })
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, run)
  return run
}

/** Jalur lama, apa adanya: satu write, satu keputusan. Dipakai sebagai penutup kalau token hasil reservasi terus disalip request lain di instance yang sama. */
async function reserveExact(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  const { count, windowEpoch } = await reserveInDb(bucket, windowSeconds, 1)
  const windowEndMs = windowEnd(windowEpoch, windowSeconds)
  return { allowed: count <= limit, retryAfter: retryAfterFrom(windowEndMs, Date.now()) }
}

/**
 * Bentuk jawabannya tidak berubah; yang berubah adalah berapa kali Postgres ditulis.
 *
 * Sebelumnya tiap pemanggilan menulis satu baris — termasuk pemanggilan yang berakhir
 * 429. Dengan 20+ route bersesi dan polling 30 detik, akuntansi rate limit sendiri
 * jadi penyumbang write terbesar di database, dan di Neon setiap write menahan compute
 * tetap bangun sekaligus menumpuk dead tuple yang cron-nya baru disapu sehari sekali.
 *
 * Sekarang izin dibeli borongan: satu write memesan beberapa token, sisanya dibelanjakan
 * dari memori proses. Invariannya yang harus dijaga siapa pun yang menyentuh berkas ini:
 * jumlah request yang diloloskan per window **tidak pernah melebihi `limit`**, karena token
 * selalu dibayar lebih dulu lewat `insert … on conflict do update` yang atomik dan cache
 * hanya menyimpan hak yang sudah dibayar itu — bukan hasil pembacaan `count`. Arah galatnya
 * satu-satunya adalah lebih ketat: token yang belum terpakai bisa hangus saat window
 * berganti atau instance mati.
 *
 * Konsekuensi yang harus disadari: **plafon efektif bisa lebih rendah dari `limit`**. Lease
 * dipegang per proses, jadi kalau request satu bucket tersebar ke beberapa instance, tiap
 * instance bisa menganggur sambil masih memegang token — paling banyak `leaseSize - 1` token
 * hangus per instance, atau `(instance - 1) × (leaseSize - 1)` untuk satu window. Semua bucket
 * di `app/api` berkunci per pemakai (`user.id`, `admin.id`, atau IP), jadi yang terkena hanya
 * satu pemakai yang request-nya berpindah instance dalam satu window; tidak ada bucket global
 * yang dibagi banyak pemakai. Yang paling lebar plafonnya `admin:economy|users|withdrawals`
 * 300/jam dengan lease 10, artinya paling buruk ~282 dari 300 (94%) kalau request satu admin
 * tersebar ke tiga instance. Toleransi ini yang dikunci `RL-4`. Bucket yang menuntut plafon
 * eksak harus di bawah `LEASE_MIN_LIMIT` — di sana reservasi memang tidak dipakai sama sekali —
 * atau memakai jalur `peekRateLimit`/`recordRateLimitHit` seperti penghitung login admin.
 *
 * Kegagalan database tetap dilempar seperti sebelumnya. Rate limiter tidak boleh fail-open.
 */
export async function checkRateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitVerdict> {
  const key = `${bucket}|${windowSeconds}`

  for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt++) {
    const held = takeFromLease(key)
    if (held === 'guard') return reserveExact(bucket, limit, windowSeconds)
    if (held) return held
    /** Belum ada lease dan window hampir habis: lease yang dipesan sekarang akan langsung kena guard-nya sendiri, jadi tokennya hangus dan request ini berputar sampai fallback. Bayar satu token saja. */
    if (inLeaseGuard(windowSeconds, Date.now())) {
      return reserveExact(bucket, limit, windowSeconds)
    }
    await reserveTokens(key, bucket, limit, windowSeconds)
  }

  return reserveExact(bucket, limit, windowSeconds)
}

/** Hanya untuk uji: buang seluruh lease supaya satu berkas uji bisa menghitung write dari nol. */
export function resetRateLimitLeases(): void {
  leases.clear()
  inflight.clear()
}

/** Penghitung brute-force login admin, bukan plafon lalu lintas: `peek` membaca tanpa menaikkan, dan `record` hanya dipanggil pada percobaan yang gagal (`app/api/admin/login/route.ts`). Keduanya sengaja tidak ikut skema reservasi — hitungannya harus eksak dan tidak boleh dilayani dari cache proses. */
export async function peekRateLimit(bucket: string, limit: number, windowSeconds: number) {
  const rows = await query<{ count: number }>(
    `select count from rate_limits where bucket=$1 and window_start=to_timestamp(floor(extract(epoch from now())/$2)*$2)`,
    [bucket, windowSeconds],
  )
  const elapsed = Math.floor(Date.now() / 1_000) % windowSeconds
  return { allowed: (rows[0]?.count ?? 0) < limit, retryAfter: windowSeconds - elapsed }
}

export async function recordRateLimitHit(bucket: string, windowSeconds: number) {
  await query(
    `insert into rate_limits(bucket,window_start,count) values($1,to_timestamp(floor(extract(epoch from now())/$2)*$2),1) on conflict(bucket,window_start) do update set count=rate_limits.count+1`,
    [bucket, windowSeconds],
  )
}
