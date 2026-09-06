import { describe, expect, it } from 'vitest'
import { leaderboardGap, type LeaderboardEntry } from './leaderboard'

const entry = (position: number, credits: number, displayName: string): LeaderboardEntry => ({
  id: `u${position}`,
  displayName,
  position,
  taskCount: 0,
  credits,
  you: false,
  frame: null,
  title: null,
  premium: false,
  photoUrl: null,
  founder: false,
})

const board = [entry(1, 62, 'Siti'), entry(2, 52, 'Preview'), entry(3, 48, 'Fajar')]

describe('BOARD-GAP — jarak ke tetangga peringkat', () => {
  it('menatap ke atas untuk siapa pun di bawah puncak', () => {
    expect(leaderboardGap(board, board[1])).toEqual({
      kind: 'chase',
      credits: 10,
      displayName: 'Siti',
    })
  })

  /** Juara tidak punya siapa pun di atasnya. Tanpa cabang ini kartunya kehilangan satu-satunya
   * angka yang bergerak, tepat untuk orang yang paling ingin menjaganya tetap bergerak. */
  it('menatap ke bawah saat sudah di puncak', () => {
    expect(leaderboardGap(board, board[0])).toEqual({
      kind: 'lead',
      credits: 10,
      displayName: 'Preview',
    })
  })

  it('mengembalikan selisih nol apa adanya, bukan menyembunyikannya', () => {
    const seri = [entry(1, 50, 'Siti'), entry(2, 50, 'Preview')]
    expect(leaderboardGap(seri, seri[1])?.credits).toBe(0)
  })

  it('tidak menghitung apa pun saat user belum masuk papan', () => {
    expect(leaderboardGap(board, null)).toBeNull()
  })

  /** Papan bisa dipotong (saringan "Semua 500"), jadi tetangga peringkatnya bisa tidak ikut
   * termuat. Menghitungnya dari baris terdekat yang ADA akan menampilkan selisih ke orang yang
   * salah — lebih baik tidak menampilkan apa pun. */
  it('diam saat tetangga peringkatnya tidak ada di daftar yang termuat', () => {
    expect(leaderboardGap([entry(5, 10, 'Jauh')], entry(9, 4, 'Preview'))).toBeNull()
  })

  it('diam saat juara berdiri sendirian di papan', () => {
    const solo = [entry(1, 20, 'Sendiri')]
    expect(leaderboardGap(solo, solo[0])).toBeNull()
  })
})
