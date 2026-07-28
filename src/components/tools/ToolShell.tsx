import {
  CheckCircle2,
  CircleAlert,
  Copy,
  Eraser,
  FileInput,
  Info,
  ShieldCheck,
} from 'lucide-react'
import {
  useId,
  useState,
  type ReactNode,
} from 'react'

import './ToolShell.css'

export type ToolFeedbackTone = 'success' | 'error' | 'info'

export interface ToolFeedbackState {
  tone: ToolFeedbackTone
  message: string
}

interface ToolShellProps {
  title: string
  description?: string
  privacyNote?: string
  children: ReactNode
  className?: string
}

interface ToolSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

interface ToolFeedbackProps {
  feedback: ToolFeedbackState | null
  id?: string
}

interface ToolOutputProps {
  id: string
  label: string
  value: string
  emptyMessage?: string
  sensitive?: boolean
  meta?: string
}

type ToolActionHandler = () => void | Promise<void>

interface ToolActionsProps {
  children?: ReactNode
  copyText?: string
  copyLabel?: string
  copySuccessMessage?: string
  onClear?: ToolActionHandler
  clearLabel?: string
  clearDisabled?: boolean
  clearSuccessMessage?: string
  onExample?: ToolActionHandler
  exampleLabel?: string
  exampleSuccessMessage?: string
  className?: string
}

interface ActionFeedback extends ToolFeedbackState {
  copySnapshot?: string
}

export function ToolShell({
  title,
  description,
  privacyNote = '本页的数据处理和生成均在当前浏览器中完成。',
  children,
  className = '',
}: ToolShellProps) {
  return (
    <div className={`tool-shell page-container ${className}`.trim()}>
      <header className="tool-shell-header">
        <div className="tool-shell-heading">
          <p className="tool-shell-eyebrow">LOCAL TOOLKIT</p>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="tool-shell-privacy-note">
          <ShieldCheck aria-hidden="true" size={18} />
          <span>{privacyNote}</span>
        </div>
      </header>
      <div className="tool-shell-content">{children}</div>
    </div>
  )
}

export function ToolSection({
  title,
  description,
  children,
  className = '',
}: ToolSectionProps) {
  const generatedId = useId()
  const headingId = `tool-section-${generatedId.replaceAll(':', '')}`

  return (
    <section
      className={`tool-shell-section ${className}`.trim()}
      aria-labelledby={headingId}
    >
      <div className="tool-shell-section-header">
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function ToolFeedback({ feedback, id }: ToolFeedbackProps) {
  if (!feedback) return null

  const Icon = feedback.tone === 'success'
    ? CheckCircle2
    : feedback.tone === 'error'
      ? CircleAlert
      : Info

  return (
    <p
      id={id}
      className={`tool-feedback tool-feedback-${feedback.tone}`}
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      aria-atomic="true"
    >
      <Icon aria-hidden="true" size={16} />
      <span>{feedback.message}</span>
    </p>
  )
}

export function ToolOutput({
  id,
  label,
  value,
  emptyMessage = '生成结果会显示在这里。',
  sensitive = false,
  meta,
}: ToolOutputProps) {
  const labelId = `${id}-label`

  return (
    <div
      className={`tool-output ${sensitive ? 'tool-output-sensitive' : ''}`.trim()}
      role="region"
      aria-labelledby={labelId}
    >
      <div className="tool-output-heading">
        <span id={labelId}>{label}</span>
        {meta ? <small>{meta}</small> : null}
      </div>
      {value ? (
        <pre id={id} tabIndex={0}>{value}</pre>
      ) : (
        <p id={id} className="tool-output-empty">{emptyMessage}</p>
      )}
    </div>
  )
}

export function ToolActions({
  children,
  copyText,
  copyLabel = '复制结果',
  copySuccessMessage = '已复制到剪贴板。',
  onClear,
  clearLabel = '清空',
  clearDisabled = false,
  clearSuccessMessage = '已清空。',
  onExample,
  exampleLabel = '使用示例',
  exampleSuccessMessage = '示例已填入。',
  className = '',
}: ToolActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null)
  const visibleFeedback = feedback?.copySnapshot !== undefined
    && feedback.copySnapshot !== copyText
    ? null
    : feedback

  const runAction = async (
    actionName: string,
    action: ToolActionHandler,
    successMessage: string,
    errorMessage: string,
    copySnapshot?: string,
  ) => {
    if (pendingAction) return
    setPendingAction(actionName)
    setFeedback(null)
    try {
      await action()
      setFeedback({ tone: 'success', message: successMessage, copySnapshot })
    } catch {
      setFeedback({ tone: 'error', message: errorMessage })
    } finally {
      setPendingAction(null)
    }
  }

  const handleCopy = () => runAction(
    'copy',
    async () => {
      if (!copyText || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(copyText)
    },
    copySuccessMessage,
    '复制失败，请检查浏览器的剪贴板权限后重试。',
    copyText,
  )

  return (
    <div className={`tool-actions-wrap ${className}`.trim()}>
      <div className="tool-actions">
        {children}
        {copyText !== undefined ? (
          <button
            type="button"
            className="tool-action-button tool-action-button-secondary"
            onClick={handleCopy}
            disabled={!copyText || pendingAction !== null}
          >
            <Copy aria-hidden="true" size={16} />
            {copyLabel}
          </button>
        ) : null}
        {onClear ? (
          <button
            type="button"
            className="tool-action-button tool-action-button-secondary"
            onClick={() => runAction(
              'clear',
              onClear,
              clearSuccessMessage,
              '清空失败，请重试。',
            )}
            disabled={clearDisabled || pendingAction !== null}
          >
            <Eraser aria-hidden="true" size={16} />
            {clearLabel}
          </button>
        ) : null}
        {onExample ? (
          <button
            type="button"
            className="tool-action-button tool-action-button-quiet"
            onClick={() => runAction(
              'example',
              onExample,
              exampleSuccessMessage,
              '载入示例失败，请重试。',
            )}
            disabled={pendingAction !== null}
          >
            <FileInput aria-hidden="true" size={16} />
            {exampleLabel}
          </button>
        ) : null}
      </div>
      <ToolFeedback feedback={visibleFeedback} />
    </div>
  )
}
