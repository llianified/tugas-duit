'use client'

import { AnimatePresence, motion } from 'motion/react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { hapticError, hapticSuccess } from '@/shared/lib/haptic'
import { EASE_OUT_QUART, SPRING_SOFT } from '@/shared/lib/motion'

const TOAST_TTL_MS = 4000

const MAX_TOASTS = 3

const SWIPE_DISMISS_PX = 36

const LEAVE_DURATION_MS = 180

/** Nada pesan. Bawaannya `error` supaya pemanggil lama yang cuma mengirim teks tidak berubah artinya. */
export type ToastTone = 'error' | 'success'

type Toast = { id: number; message: string; tone: ToastTone }

type ShowToast = (message: string, tone?: ToastTone) => void

const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const showToast = useContext(ToastContext)
  if (!showToast) throw new Error('useToast dipakai di luar <ToastProvider>')
  return showToast
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback<ShowToast>((message, tone = 'error') => {
    const trimmed = message.trim()
    if (!trimmed) return
    if (tone === 'success') hapticSuccess()
    else hapticError()
    setToasts((current) => {
      const withoutDuplicate = current.filter((toast) => toast.message !== trimmed)
      const next = [...withoutDuplicate, { id: nextId.current++, message: trimmed, tone }]
      return next.slice(-MAX_TOASTS)
    })
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-layer">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false)
  const [dragY, setDragY] = useState<number | null>(null)
  const startY = useRef(0)

  const close = useCallback(() => {
    setLeaving(true)
    onDismiss(toast.id)
  }, [onDismiss, toast.id])

  useEffect(() => {
    const id = window.setTimeout(close, TOAST_TTL_MS)
    return () => window.clearTimeout(id)
  }, [close])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (leaving) return
    startY.current = event.clientY
    setDragY(0)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragY === null) return
    setDragY(Math.max(0, event.clientY - startY.current))
  }

  function handlePointerUp() {
    if (dragY === null) return
    if (dragY >= SWIPE_DISMISS_PX) {
      close()
      return
    }
    setDragY(null)
  }

  return (
    <motion.div
      role={toast.tone === 'success' ? 'status' : 'alert'}
      aria-live={toast.tone === 'success' ? 'polite' : 'assertive'}
      data-tone={toast.tone}
      className="toast-item bubble-p"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{
        opacity: 1,
        y: dragY ?? 0,
        scale: 1,
        transition: dragY !== null ? { duration: 0 } : SPRING_SOFT,
      }}
      exit={{
        opacity: 0,
        y: 12,
        scale: 0.97,
        transition: { duration: LEAVE_DURATION_MS / 1000, ease: EASE_OUT_QUART },
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {toast.message}
    </motion.div>
  )
}
