'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Challenge, TaskOutcome, TaskSubmission } from '@/features/captcha/domain'
import { userFacingMessage } from '@/shell/api-client'
import { hapticError, hapticSuccess, hapticWarning } from '@/shell/haptic'

export type CaptchaAttemptStatus = 'idle' | 'error' | 'success'

export function useCaptchaAttempt(
  challenge: Challenge,
  onSubmit: (answer: string) => Promise<TaskSubmission | null>,
  onError: (message: string) => void,
  initialElapsedMs = 0,
) {
  const [status, setStatus] = useState<CaptchaAttemptStatus>('idle')
  const [textAnswer, setTextAnswer] = useState('')
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [rejectedAnswer, setRejectedAnswer] = useState<string | null>(null)
  const [attemptsExhausted, setAttemptsExhausted] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [outcome, setOutcome] = useState<TaskOutcome | null>(null)
  const startedAt = useRef<number | null>(null)
  const [liveElapsedMs, setLiveElapsedMs] = useState(initialElapsedMs)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])
  const notifyError = useCallback((message: string) => onErrorRef.current(message), [])

  useEffect(() => {
    startedAt.current = performance.now() - initialElapsedMs
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

  const answer = challenge.type === 'select' ? (selectedOption ?? '') : textAnswer

  const expectedLength =
    challenge.type === 'text'
      ? challenge.display.length
      : challenge.type === 'math'
        ? challenge.answerLength
        : null

  const answerComplete =
    expectedLength === null ? answer.trim().length > 0 : answer.trim().length === expectedLength

  const canVerify =
    answerComplete &&
    status !== 'success' &&
    !attemptsExhausted &&
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
    verifying,
    attemptsExhausted,
    canVerify,
    updateAnswer,
    selectOption,
    verify,
  }
}
