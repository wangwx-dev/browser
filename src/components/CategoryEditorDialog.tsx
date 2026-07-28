import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { FolderPlus, X } from 'lucide-react'

interface CategoryEditorDialogProps {
  initialName?: string
  mode: 'create' | 'edit'
  onCancel: () => void
  onSave: (name: string) => boolean
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function CategoryEditorDialog({
  initialName = '',
  mode,
  onCancel,
  onSave,
}: CategoryEditorDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState('')

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    inputRef.current?.select()

    return () => {
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus()
    }
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return

    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    if (focusable.length === 0) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1) ?? first
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const handleSubmit = () => {
    const normalized = name.trim()
    if (!normalized) {
      setError('请输入分类名称。')
      inputRef.current?.focus()
      return
    }
    if (normalized.length > 80) {
      setError('分类名称不能超过 80 个字符。')
      inputRef.current?.focus()
      return
    }
    if (!onSave(normalized)) {
      setError('暂时无法保存这个分类，请重试。')
    }
  }

  const title = mode === 'create' ? '新增分类' : '编辑分类'

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        ref={dialogRef}
        className="dialog-panel category-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={handleKeyDown}
      >
        <header className="dialog-header">
          <div className="dialog-copy">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}><FolderPlus aria-hidden="true" size={18} />分类用于整理常用网站，之后仍可改名和排序。</p>
          </div>
          <button type="button" className="dialog-close" aria-label={`关闭${title}`} onClick={onCancel}>
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div className="form-field">
            <label htmlFor={`${titleId}-name`}>分类名称</label>
            <input
              ref={inputRef}
              id={`${titleId}-name`}
              value={name}
              maxLength={80}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              placeholder="例如：开发常用"
              onChange={(event) => {
                setName(event.target.value)
                if (error) setError('')
              }}
            />
            <div className="field-meta">
              {error ? <span id={errorId} className="field-error" role="alert">{error}</span> : <span />}
              <span>{name.length}/80</span>
            </div>
          </div>

          <footer className="dialog-actions">
            <button type="button" className="btn btn-secondary dialog-button dialog-button-cancel" onClick={onCancel}>取消</button>
            <button type="submit" className="btn dialog-button dialog-button-confirm">{mode === 'create' ? '创建分类' : '保存分类'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
