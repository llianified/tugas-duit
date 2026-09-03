import { describe, expect, it } from 'vitest'
import { parseAdPostback, postbackRewardPaid, readMacro } from './postback'

const params = (query: string) => new URLSearchParams(query)

describe('POSTBACK-1 — "dibayar" dibaca dari dua ejaan yang sama-sama dipakai Monetag', () => {
  it('menerima ejaan dashboard maupun ejaan dokumentasi', () => {
    for (const value of ['yes', 'YES', 'valued', 'Valued', 'true', '1']) {
      expect(postbackRewardPaid(value), value).toBe(true)
    }
  })

  it('menolak apa pun selain itu, termasuk nilai yang tidak dikenal', () => {
    for (const value of ['no', 'not_valued', 'false', '0', 'paid', '', null]) {
      expect(postbackRewardPaid(value), String(value)).toBe(false)
    }
  })
})

describe('POSTBACK-2 — makro yang gagal terisi dibaca kosong, bukan sebagai nilai', () => {
  it('membuang bentuk mentah kurung kurawal, dolar, dan ter-encode', () => {
    expect(readMacro('{ymid}')).toBeNull()
    expect(readMacro('${YMID}')).toBeNull()
    expect(readMacro('%7Bymid%7D')).toBeNull()
    expect(readMacro('  ')).toBeNull()
  })

  it('membuat URL yang salah pasang gagal ke arah menutup, bukan membuka', () => {
    const parsed = parseAdPostback(params('ymid={ymid}&reward_event_type={reward_event_type}'))
    expect(parsed.ymid).toBeNull()
    expect(parsed.paid).toBe(false)
  })
})

describe('POSTBACK-3 — parameter dibaca sesuai nama makro Monetag', () => {
  it('mengambil ymid, jenis event, harga, zone, dan placement', () => {
    const parsed = parseAdPostback(
      params(
        'ymid=1f1c4a5e-0d1b-4c2a-9b7e-2f3a4b5c6d7e&event_type=click&reward_event_type=yes' +
          '&estimated_price=0.00231&zone_id=11615417&request_var=task_ticket',
      ),
    )
    expect(parsed).toEqual({
      ymid: '1f1c4a5e-0d1b-4c2a-9b7e-2f3a4b5c6d7e',
      event: 'click',
      paid: true,
      price: 0.00231,
      zoneId: '11615417',
      requestVar: 'task_ticket',
    })
  })

  it('membiarkan harga kosong tanpa menggagalkan pembacaan — harga catatan, bukan syarat', () => {
    const parsed = parseAdPostback(params('ymid=abc&event_type=impression&reward_event_type=yes'))
    expect(parsed.paid).toBe(true)
    expect(parsed.price).toBeNull()
    expect(parsed.event).toBe('impression')
  })

  it('menolak jenis event yang bukan impression atau click', () => {
    expect(parseAdPostback(params('event_type=conversion')).event).toBeNull()
  })
})
