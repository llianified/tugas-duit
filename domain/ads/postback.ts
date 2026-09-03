/** Pembacaan parameter postback Monetag. Murni bentuk — pencocokan tiket dan penerbitan pass ada di `server/ads/postback.ts`. | Nama parameternya kita sendiri yang menentukan (URL-nya kita yang menulis), jadi sengaja dibuat sama persis dengan nama makro di dokumentasi Monetag: URL yang ditempel di dashboard jadi bisa dibaca tanpa penerjemahan, dan salah pasang makro terlihat langsung. */

export type AdPostbackEvent = 'impression' | 'click'

export interface AdPostbackParams {
  ymid: string | null
  event: AdPostbackEvent | null
  paid: boolean
  price: number | null
  zoneId: string | null
  requestVar: string | null
}

/** Makro yang tidak dikenali dashboard tetap terkirim apa adanya — `{ymid}`, `${YMID}`, atau bentuk ter-encode `%7Bymid%7D`. Nilai seperti itu bukan data, jadi dibaca sebagai kosong; kalau tidak, URL yang salah pasang akan terlihat seperti postback yang sah dengan nilai aneh. */
const UNEXPANDED = /^[{$%]/

export function readMacro(value: string | null): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || UNEXPANDED.test(trimmed)) return null
  return trimmed
}

/** Dashboard Monetag menulis "yes"/"no" pada makro Reward event type, sedangkan dokumentasinya menyebut "valued"/"not_valued". Keduanya diterima karena yang menentukan bukan ejaannya melainkan satu pertanyaan: event ini dibayar atau tidak. Apa pun di luar daftar ini dianggap TIDAK dibayar — gerbang yang tidak yakin harus gagal ke arah menutup, bukan membuka. */
const PAID_VALUES = new Set(['yes', 'valued', 'true', '1'])

export function postbackRewardPaid(value: string | null): boolean {
  const raw = readMacro(value)
  return raw !== null && PAID_VALUES.has(raw.toLowerCase())
}

function readEvent(value: string | null): AdPostbackEvent | null {
  const raw = readMacro(value)?.toLowerCase()
  return raw === 'impression' || raw === 'click' ? raw : null
}

/** Harga dipakai sebagai catatan, bukan sebagai syarat. Event yang dibayar 0.00000 tetap event yang dibayar menurut Monetag, dan menolaknya berarti menghukum user atas lelang yang kebetulan murah. */
function readPrice(value: string | null): number | null {
  const raw = readMacro(value)
  if (raw === null) return null
  const price = Number(raw)
  return Number.isFinite(price) && price >= 0 ? price : null
}

export function parseAdPostback(params: URLSearchParams): AdPostbackParams {
  return {
    ymid: readMacro(params.get('ymid')),
    event: readEvent(params.get('event_type')),
    paid: postbackRewardPaid(params.get('reward_event_type')),
    price: readPrice(params.get('estimated_price')),
    zoneId: readMacro(params.get('zone_id')),
    requestVar: readMacro(params.get('request_var')),
  }
}
