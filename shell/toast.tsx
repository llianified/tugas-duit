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
import { hapticError } from '@/shell/haptic'
import { EASE_OUT_QUART, SPRING_SOFT } from '@/shared/lib/motion'

const TOAST_TTL_MS = 4000

const MAX_TOASTS = 3

const SWIPE_DISMISS_PX = 36

const LEAVE_DURATION_MS = 180

type Toast = { id: number; message: string }

type ShowError = (message: string) => void

const ToastContext = createContext<ShowError | null>(null)

export function useToast(): ShowError {
  const showError = useContext(ToastContext)
  if (!showError) throw new Error('useToast dipakai di luar <ToastProvider>')
  return showError
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showError = useCallback<ShowError>((message) => {
    const trimmed = message.trim()
    if (!trimmed) return
    hapticError()
    setToasts((current) => {
      const withoutDuplicate = current.filter((toast) => toast.message !== trimmed)
      const next = [...withoutDuplicate, { id: nextId.current++, message: trimmed }]
      return next.slice(-MAX_TOASTS)
    })
  }, [])

  return (
    <ToastContext.Provider value={showError}>
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
      role="alert"
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
