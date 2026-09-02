type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'

type NotificationType = 'error' | 'success' | 'warning'

type TelegramHapticFeedback = {
  impactOccurred?: (style: ImpactStyle) => void
  notificationOccurred?: (type: NotificationType) => void
  selectionChanged?: () => void
}

type TelegramHapticWebApp = {
  HapticFeedback?: TelegramHapticFeedback
  isVersionAtLeast?: (version: string) => boolean
}

const MIN_VERSION = '6.1'

function hapticFeedback(): TelegramHapticFeedback | undefined {
  if (typeof window === 'undefined') return undefined
  const telegram = (window as Window & { Telegram?: { WebApp?: TelegramHapticWebApp } }).Telegram
    ?.WebApp
  if (!telegram?.HapticFeedback) return undefined
  if (!telegram.isVersionAtLeast?.(MIN_VERSION)) return undefined
  return telegram.HapticFeedback
}

function safely(run: (feedback: TelegramHapticFeedback) => void) {
  const feedback = hapticFeedback()
  if (!feedback) return
  try {
    run(feedback)
  } catch {
    return
  }
}

export function hapticTap() {
  safely((feedback) => feedback.impactOccurred?.('light'))
}

export function hapticConfirm() {
  safely((feedback) => feedback.impactOccurred?.('medium'))
}

export function hapticSelect() {
  safely((feedback) => feedback.selectionChanged?.())
}

export function hapticSuccess() {
  safely((feedback) => feedback.notificationOccurred?.('success'))
}

export function hapticWarning() {
  safely((feedback) => feedback.notificationOccurred?.('warning'))
}

export function hapticError() {
  safely((feedback) => feedback.notificationOccurred?.('error'))
}
