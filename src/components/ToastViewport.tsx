import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ToastItem {
  id: string
  message: string
  tone?: 'info' | 'success' | 'warning' | 'error'
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  onDismiss: () => void
  onPause?: () => void
  onResume?: () => void
}

export function ToastViewport({ items }: { items: readonly ToastItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="toast-viewport" aria-label="通知">
      {items.map((item) => (
        <aside
          key={item.id}
          className={`workspace-toast workspace-toast-${item.tone ?? 'info'}`}
          role={item.tone === 'error' ? 'alert' : 'status'}
          onMouseEnter={item.onPause}
          onMouseLeave={item.onResume}
          onFocusCapture={item.onPause}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) item.onResume?.()
          }}
        >
          {item.icon}
          <span>{item.message}</span>
          {item.actionLabel && item.onAction && (
            <button type="button" className="workspace-toast-action" onClick={item.onAction}>{item.actionLabel}</button>
          )}
          <button type="button" className="workspace-toast-close" aria-label="关闭通知" onClick={item.onDismiss}>
            <X aria-hidden="true" size={18} />
          </button>
        </aside>
      ))}
    </div>
  )
}
