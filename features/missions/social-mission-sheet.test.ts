import { describe, expect, it } from 'vitest'
import {
  buildFacebookShareText,
  buildTwitterShareText,
  contentFor,
  FACEBOOK_HOME_URL,
  secondsUntilConfirmation,
  X_LIKE_REPOST_URL,
} from './social-mission-sheet'

const REFERRAL_URL = 'https://t.me/tugasduitbot/app?startapp=REF123'

describe('pesan misi sosial', () => {
  it('menyertakan mention dan link referral user pada template Twitter', () => {
    const text = buildTwitterShareText(REFERRAL_URL)

    expect(text).toContain('@Tugasduit')
    expect(text).toContain(REFERRAL_URL)
    expect(contentFor('twitter_post').instruction).toBe(
      'Tekan tombol dibawah, lalu post ke Twitter.',
    )
  })

  it('menyatukan Like dan Retweet pada satu postingan X', () => {
    expect(contentFor('twitter_like_repost')).toMatchObject({
      actionLabel: 'Buka postingan di X',
      confirmLabel: 'Ya, keduanya sudah',
    })
    expect(X_LIKE_REPOST_URL).toBe(
      'https://x.com/TugasDuit/status/2095765886091276589',
    )
  })

  it('menyertakan link referral user dan membuka beranda Facebook', () => {
    const text = buildFacebookShareText(REFERRAL_URL)

    expect(text).toContain(REFERRAL_URL)
    expect(contentFor('facebook_post').instruction).toBe(
      'Salin & buka tombol dibawah lalu posting ke grup manapun.',
    )
    expect(FACEBOOK_HOME_URL).toBe('https://www.facebook.com/')
  })
})

describe('countdown konfirmasi misi sosial', () => {
  it('mengabaikan selisih absolut jam perangkat dan memakai waktu server sebagai jangkar', () => {
    const timing = {
      serverNow: 1_000_000,
      confirmAt: 1_030_000,
      receivedAt: 20_000_000,
    }

    expect(secondsUntilConfirmation(timing, 20_005_000)).toBe(25)
  })

  it('berhenti di nol setelah waktu konfirmasi server terlewati', () => {
    const timing = {
      serverNow: 1_000_000,
      confirmAt: 1_010_000,
      receivedAt: 20_000_000,
    }

    expect(secondsUntilConfirmation(timing, 20_015_000)).toBe(0)
  })
})
