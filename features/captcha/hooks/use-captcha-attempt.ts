'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  orderAnswerFromPicks,
  type Challenge,
  type TaskOutcome,
  type TaskSubmission,
} from '@/domain/task/challenge'
import { ApiError, userFacingMessage } from '@/shell/api-client'
import { hapticError, hapticSuccess, hapticWarning } from '@/shared/lib/haptic'

export type CaptchaAttemptStatus = 'idle' | 'error' | 'success'

/** Kode `/api/task/submit` yang berarti soalnya sudah TUTUP, bukan jawabannya yang salah. Semuanya dijawab dengan status 4xx, jadi `sendJson` melemparnya sebagai `ApiError` dan tidak pernah sampai ke cabang `attemptsLeft`. Tanpa daftar ini layar task cuma memunculkan toast lalu menyisakan tombol "Cek" yang dijamin gagal setiap kali ditekan: waktunya sudah habis, atau ongkosnya sudah dikembalikan dan yang dibutuhkan soal baru. `RATE_LIMITED` dan `INTERNAL` sengaja TIDAK di sini — keduanya alasan untuk mencoba lagi, bukan untuk menutup soal. */
const ENDED_CODES: readonly string[] = [
  'CHALLENGE_EXPIRED',
  'CHALLENGE_NOT_FOUND',
  'CHALLENGE_NOT_STARTED',
  'CHALLENGE_ALREADY_SUBMITTED',
  'TOO_MANY_ATTEMPTS',
  'REWARD_POOL_EMPTY',
  'DAILY_TASK_LIMIT',
]

export function isChallengeEndedError(error: unknown): boolean {
  return error instanceof ApiError && ENDED_CODES.includes(error.code)
}

export function useCaptchaAttempt(
  challenge: Challenge,
  onSubmit: (answer: string) => Promise<TaskSubmission | null>,
  onError: (message: string) => void,
  initialElapsedMs = 0,
) {
  const [status, setStatus] = useState<CaptchaAttemptStatus>('idle')
  const [textAnswer, setTextAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  /** Urutan ketukan untuk soal Urutkan Angka. Disimpan sebagai daftar, bukan string, karena yang
   * dibutuhkan UI adalah nomor urut tiap petak — dan "sudah lengkap" di soal ini berarti seluruh
   * petak sudah diketuk, bukan panjang teks tertentu. */
  const [orderPicks, setOrderPicks] = useState<number[]>([])
  const [rejectedAnswer, setRejectedAnswer] = useState<string | null>(null)
  const [attemptsExhausted, setAttemptsExhausted] = useState(false)
  const [challengeEnded, setChallengeEnded] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null)
  const startedAt = useRef<number | null>(null)
  // Captured once: later changes must not shift the clock mid-attempt.
  const initialElapsedRef = useRef(initialElapsedMs)
  const [liveElapsedMs, setLiveElapsedMs] = useState(initialElapsedMs)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const notifyError = useCallback((message: string) => onErrorRef.current(message), [])

  useEffect(() => {
    startedAt.current = performance.now() - initialElapsedRef.current
  }, [])

  useEffect(() => {
    if (verifying || outcome) return
    const tick = () => {
      if (startedAt.current !== null) setLiveElapsedMs(performance.now() - startedAt.current)
    }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [outcome, verifying])

  const answer =
    challenge.type === 'select'
      ? (selectedOption ?? '')
      : challenge.type === 'order'
        ? orderAnswerFromPicks(challenge.tiles, orderPicks)
        : textAnswer

  const expectedLength =
    challenge.type === 'text' || challenge.type === 'math' || challenge.type === 'count'
      ? challenge.answerLength
      : null

  const answerComplete =
    challenge.type === 'order'
      ? orderPicks.length === challenge.tiles.length
      : expectedLength === null
        ? answer.trim().length > 0
        : answer.trim().length === expectedLength

  /** Soal yang sudah tutup — waktunya habis, ongkosnya dikembalikan, atau sudah dikirim — tidak lagi menyediakan jalan mencoba. Layar task memakai ini untuk menawarkan soal baru alih-alih tombol "Cek" yang pasti ditolak. */
  const finished = attemptsExhausted || challengeEnded

  const canVerify =
    answerComplete &&
    status !== 'success' &&
    !finished &&
    answer !== rejectedAnswer

  const clearError = useCallback(() => {
    setStatus((current) => (current === 'error' ? 'idle' : current))
  }, [])

  const updateAnswer = useCallback(
    (value: string) => {
      if (verifying) return
      setTextAnswer(value)
      clearError()
    },
    [clearError, verifying],
  )

  /** Mengetuk petak yang sama lagi membatalkannya beserta seluruh ketukan sesudahnya. Itu satu-
   * satunya pembatalan yang punya arti di soal berurutan: membuang satu ketukan di tengah akan
   * menyisakan urutan yang tidak pernah bisa dilanjutkan jadi jawaban yang benar. */
  const pickTile = useCallback(
    (index: number) => {
      if (verifying) return
      setOrderPicks((current) => {
        const at = current.indexOf(index)
        return at === -1 ? [...current, index] : current.slice(0, at)
      })
      clearError()
    },
    [clearError, verifying],
  )

  const selectOption = useCallback(
    (value: string) => {
      if (verifying) return
      setSelectedOption(value)
      clearError()
    },
    [clearError, verifying],
  )

  const verify = useCallback(async () => {
    if (!canVerify || verifying) return
    setVerifying(true)
    try {
      const result = await onSubmit(answer)
      if (!result) {
        setRejectedAnswer(answer)
        hapticError()
        notifyError('Belum pas — coba lagi')
        setStatus('error')
        return
      }
      if ('attemptsLeft' in result) {
        setRejectedAnswer(answer)
        setAttemptsExhausted(result.attemptsLeft === 0)
        if (result.attemptsLeft > 0) hapticError()
        else hapticWarning()
        notifyError(
          result.attemptsLeft > 0
            ? `Jawaban salah. Sisa ${result.attemptsLeft} percobaan.`
            : 'Belum pas. Percobaan kamu udah habis.',
        )
        setStatus('error')
        return
      }
      setLiveElapsedMs(result.elapsedMs)
      setOutcome(result)
      setStatus('success')
      hapticSuccess()
    } catch (cause) {
      hapticError()
      notifyError(userFacingMessage(cause))
      if (isChallengeEndedError(cause)) setChallengeEnded(true)
      setStatus('error')
    } finally {
      setVerifying(false)
    }
  }, [answer, canVerify, notifyError, onSubmit, verifying])

  return {
    status,
    outcome,
    liveElapsedMs: outcome ? outcome.elapsedMs : liveElapsedMs,
    textAnswer,
    selectedOption,
    orderPicks,
    verifying,
    attemptsExhausted,
    finished,
    canVerify,
    updateAnswer,
    selectOption,
    pickTile,
    verify,
  }
}
