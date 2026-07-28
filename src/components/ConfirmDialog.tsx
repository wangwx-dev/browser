import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  )
}

export type ConfirmDialogTone = 'default' | 'danger'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: ConfirmDialogTone
  busy?: boolean
  error?: string
  failureMessage?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = '取消',
  tone = 'danger',
  busy = false,
  error,
  failureMessage = '操作失败，请重试。',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [pending, setPending] = useState(false)
  const [localError, setLocalError] = useState('')
  const interactionBlocked = busy || pending

  useEffect(() => {
    if (!open) return

    setLocalError('')
    const activeElement = document.activeElement
    returnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement.isConnected ? activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => {
      cancelRef.current?.focus()
      if (document.activeElement !== cancelRef.current) dialogRef.current?.focus()
    })

    return () => {
      cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      const returnTarget = returnFocusRef.current
      returnFocusRef.current = null
      requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus()
      })
    }
  }, [open])

  const requestCancel = () => {
    if (!interactionBlocked) onCancel()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      requestCancel()
      return
    }
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return
    const focusable = focusableElements(dialog)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) {
      event.preventDefault()
      dialog.focus()
      return
    }

    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) requestCancel()
  }

  const handleConfirm = async () => {
    if (interactionBlocked) return
    setPending(true)
    setLocalError('')
    try {
      await onConfirm()
    } catch {
      setLocalError(failureMessage)
    } finally {
      setPending(false)
    }
  }

  if (!open) return null

  const visibleError = error || localError
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        ref={dialogRef}
        className={`dialog-panel confirm-dialog confirm-dialog-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={interactionBlocked || undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <div id={descriptionId} className="dialog-description">{description}</div>
        </div>

        {visibleError && <div className="dialog-error" role="alert">{visibleError}</div>}

        <div className="dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-secondary dialog-button dialog-button-cancel"
            disabled={interactionBlocked}
            onClick={requestCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn dialog-button dialog-button-confirm dialog-button-${tone}`}
            disabled={interactionBlocked}
            onClick={() => { void handleConfirm() }}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
