import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_ERROR_MESSAGE, userFacingMessage } from './api-client'

describe('UI-1 — pesan error yang sampai ke user selalu bahasa Indonesia', () => {
  it('meneruskan pesan server apa adanya', () => {
    const error = new ApiError('Saldo kamu nggak cukup.', 'INSUFFICIENT_BALANCE', 400)
    expect(userFacingMessage(error)).toBe('Saldo kamu nggak cukup.')
  })

  it('tidak membocorkan pesan bawaan fetch saat jaringan putus', () => {
    const error = new TypeError('Failed to fetch')
    expect(userFacingMessage(error)).toBe(NETWORK_ERROR_MESSAGE)
    expect(userFacingMessage(error)).not.toContain('fetch')
  })

  it('menangani error yang bukan Error sama sekali', () => {
    expect(userFacingMessage('boom')).toBe(NETWORK_ERROR_MESSAGE)
    expect(userFacingMessage(undefined)).toBe(NETWORK_ERROR_MESSAGE)
  })

  it('memakai pesan cadangan yang diberikan pemanggil', () => {
    expect(userFacingMessage(new TypeError('Load failed'), 'Gagal masuk.')).toBe('Gagal masuk.')
  })
})
