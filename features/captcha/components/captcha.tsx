'use client'

import { useEffect, useRef, type Ref } from 'react'
import { CaptchaAnswerSlots } from '@/features/captcha/components/answer-slots'
import {
  ChallengeMath,
  ChallengeSelect,
  ChallengeSelectBoard,
  ChallengeText,
} from '@/features/captcha/components/board'
import { CaptchaKeypad } from '@/features/captcha/components/keypad'
import { CaptchaMeter } from '@/features/captcha/components/meter'
import { CaptchaSuccessPanel } from '@/features/captcha/components/success'
import { ActionButton } from '@/shared/components/action-button'
import { GlyphSpinner } from '@/shared/components/glyph'
import { PageHeader } from '@/shared/components/page-header'
import { VIEW_TITLE } from '@/navigation/app-view'
import type { Challenge, TaskSubmission } from '@/features/captcha/domain'
import { prefetchConfetti } from '@/shared/lib/confetti'
import { useCaptchaAttempt } from '@/features/captcha/hooks/use-captcha-attempt'

interface CaptchaViewProps {
  challenge: Challenge
  balance: number
  rewardPoolCredits: number | null
  elapsedMs?: number
  onSuccess: (answer: string) => Promise<TaskSubmission | null>
  onNext: () => void
  onExit: () => void
  onError: (message: string) => void
  onRewardChange: (reward: number) => void
}

export function CaptchaView({
  challenge,
  balance,
  rewardPoolCredits,
  elapsedMs = 0,
  onSuccess,
  onNext,
  onExit,
  onError,
  onRewardChange,
}: CaptchaViewProps) {
  const attempt = useCaptchaAttempt(challenge, onSuccess, onError, elapsedMs)
  const inputLocked = attempt.verifying || attempt.attemptsExhausted

  const verifyButtonRef = useRef<HTMLButtonElement>(null)

  const buttonWasFocused = useRef(false)

  function handleVerifyFromButton() {
    buttonWasFocused.current = document.activeElement === verifyButtonRef.current
    attempt.verify()
  }

  useEffect(() => {
    if (attempt.verifying) return
    const button = verifyButtonRef.current
    if (buttonWasFocused.current && button && !button.disabled) button.focus()
    buttonWasFocused.current = false
  }, [attempt.verifying])

  const answerLength =
    challenge.type === 'text'
      ? challenge.display.length
      : challenge.type === 'math'
        ? challenge.answerLength
        : null

  function handleKeypadKey(char: string) {
    if (answerLength === null || attempt.textAnswer.length >= answerLength) return
    attempt.updateAnswer(attempt.textAnswer + char)
  }

  function handleKeypadBackspace() {
    attempt.updateAnswer(attempt.textAnswer.slice(0, -1))
  }

  useEffect(prefetchConfetti, [])

  if (attempt.outcome) {
    return (
      <div className="view-min-h flex flex-col gap-3">
        <TopBar />
        <CaptchaSuccessPanel outcome={attempt.outcome} balance={balance} onNext={onNext} onExit={onExit} />
      </div>
    )
  }

  return (
    <div className="view-min-h flex flex-col gap-3">
      <TopBar />

      <CaptchaMeter
        difficulty={challenge.difficulty}
        elapsedMs={attempt.liveElapsedMs}
        rewardPoolCredits={rewardPoolCredits}
        onRewardChange={onRewardChange}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {challenge.type === 'text' && <ChallengeText display={challenge.display} />}
        {challenge.type === 'math' && <ChallengeMath expression={challenge.expression} />}
        {challenge.type === 'select' && <ChallengeSelectBoard instruction={challenge.instruction} />}

        {challenge.type === 'select' ? (
          <ChallengeSelect
            options={challenge.options}
            selected={attempt.selectedOption}
            status={attempt.status}
            disabled={inputLocked}
            onSelect={attempt.selectOption}
          />
        ) : (
          <CaptchaAnswerSlots
            value={attempt.textAnswer}
            length={challenge.type === 'text' ? challenge.display.length : challenge.answerLength}
            validationType={challenge.type === 'text' ? 'alphanumeric' : 'numeric'}
            uppercase={challenge.type === 'text'}
            hasError={attempt.status === 'error'}
            disabled={inputLocked}
            onChange={attempt.updateAnswer}
            onSubmit={attempt.verify}
          />
        )}
      </div>

      {attempt.attemptsExhausted ? (
        <>
          <ActionButton onClick={onNext}>Muat soal baru</ActionButton>
          <ActionButton variant="quiet" onClick={onExit}>
            Kembali ke beranda
          </ActionButton>
        </>
      ) : (
        <VerifyButton
          ref={verifyButtonRef}
          disabled={!attempt.canVerify || attempt.verifying}
          verifying={attempt.verifying}
          onVerify={handleVerifyFromButton}
        />
      )}

      {answerLength !== null && (
        <CaptchaKeypad
          layout={challenge.type === 'text' ? 'alphanumeric' : 'numeric'}
          full={attempt.textAnswer.length >= answerLength}
          empty={attempt.textAnswer.length === 0}
          disabled={inputLocked}
          onKey={handleKeypadKey}
          onBackspace={handleKeypadBackspace}
        />
      )}
    </div>
  )
}

function TopBar() {
  return <PageHeader title={VIEW_TITLE.captcha} />
}

function VerifyButton({
  disabled,
  verifying,
  onVerify,
  ref,
}: {
  disabled: boolean
  verifying: boolean
  onVerify: () => void
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <ActionButton
      ref={ref}
      onClick={onVerify}
      disabled={disabled}
      className={!disabled && !verifying ? 'cta-sheen' : undefined}
    >
      {verifying ? (
        <>
          <GlyphSpinner className="size-4 animate-spin" />
          Memverifikasi
        </>
      ) : (
        'Verifikasi'
      )}
    </ActionButton>
  )
}
