import { describe, expect, it } from 'vitest'
import {
  buildFacebookShareText,
  buildTwitterShareText,
  buildWhatsappShareText,
  contentFor,
  FACEBOOK_HOME_URL,
  secondsUntilConfirmation,
  TIKTOK_PROFILE_URL,
  WHATSAPP_SHARE_URL,
  X_LIKE_REPOST_URL,
} from './social-mission-sheet'

const REFERRAL_URL = 'https://t.me/tugasduitbot/app?startapp=REF123'

/** Yang dikunci di sini isi teknisnya — mention, link referral, tujuan tautan — BUKAN kalimat instruksinya. Versi sebelumnya menyamakan `instruction` dengan string persis, jadi setiap perbaikan penulisan menggagalkan test yang sebenarnya tidak menguji apa pun soal itu. Bentuk kalimatnya dijaga `COPY-1` di `tests/copy.test.ts`, yang menguji aturannya, bukan kata-katanya. */
describe('pesan misi sosial', () => {
  const SOCIAL_ACTIONS = [
    'twitter_follow',
    'twitter_like_repost',
    'twitter_post',
    'facebook_post',
    'whatsapp_share',
    'tiktok_follow',
  ] as const

  it('menyertakan mention dan link referral user pada template Twitter', () => {
    const text = buildTwitterShareText(REFERRAL_URL)

    expect(text).toContain('@Tugasduit')
    expect(text).toContain(REFERRAL_URL)
  })

  it('menyatukan Like dan Retweet pada satu postingan X', () => {
    expect(X_LIKE_REPOST_URL).toBe(
      'https://x.com/TugasDuit/status/2095765886091276589',
    )
    expect(contentFor('twitter_like_repost').instruction).toMatch(/like/i)
    expect(contentFor('twitter_like_repost').instruction).toMatch(/retweet/i)
  })

  it('menyertakan link referral user dan membuka beranda Facebook', () => {
    const text = buildFacebookShareText(REFERRAL_URL)

    expect(text).toContain(REFERRAL_URL)
    expect(contentFor('facebook_post').instruction).toMatch(/facebook/i)
    expect(FACEBOOK_HOME_URL).toBe('https://www.facebook.com/')
  })

  it('menyertakan link referral user pada teks bagikan WhatsApp', () => {
    const text = buildWhatsappShareText(REFERRAL_URL)

    expect(text).toContain(REFERRAL_URL)
    /** Tautannya membawa teksnya sendiri, jadi tidak ada langkah salin-tempel seperti Facebook. */
    expect(WHATSAPP_SHARE_URL).toBe('https://wa.me/')
    expect(new URL(WHATSAPP_SHARE_URL).searchParams.get('text')).toBeNull()
  })

  /** Yang dipaku handle-nya, bukan kalimatnya: profil yang salah mengirim orang ke akun yang bukan
   * milik Tugas Duit, dan misinya tetap bisa dikonfirmasi karena tidak ada yang memverifikasi. */
  it('menunjuk profil TikTok Tugas Duit dan menyebut handle-nya di instruksi', () => {
    expect(TIKTOK_PROFILE_URL).toBe('https://www.tiktok.com/@tugas.duit')
    expect(contentFor('tiktok_follow').instruction).toContain('@tugas.duit')
  })

  it('memberi tiap misi instruksi, label aksi, dan konfirmasi yang terisi', () => {
    for (const action of SOCIAL_ACTIONS) {
      const konten = contentFor(action)
      expect(konten.instruction.length).toBeGreaterThan(0)
      expect(konten.actionLabel.length).toBeGreaterThan(0)
      expect(konten.confirmation.endsWith('?')).toBe(true)
      expect(konten.confirmLabel.length).toBeGreaterThan(0)
    }
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
