import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { Sparkles, X } from 'lucide-react'

import type { NavCategoryV2, NavLinkV2 } from '../types/workspace'

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const NAME_LIMIT = 80
const URL_LIMIT = 2048
const DESCRIPTION_LIMIT = 240

export type LinkEditorValue = Pick<NavLinkV2, 'name' | 'url' | 'description' | 'icon'>
export type LinkMetadata = Partial<Pick<NavLinkV2, 'name' | 'description' | 'icon'>>
export type LinkEditorCategory = Pick<NavCategoryV2, 'id' | 'name'>
export type LinkEditorSubmitValue = LinkEditorValue & { categoryId?: NavCategoryV2['id'] }

export interface LinkEditorDialogProps {
  open: boolean
  mode?: 'create' | 'edit'
  initialValue?: LinkEditorValue
  busy?: boolean
  error?: string
  categories?: readonly LinkEditorCategory[]
  selectedCategoryId?: NavCategoryV2['id'] | ''
  onSelectedCategoryIdChange?: (categoryId: NavCategoryV2['id'] | '') => void
  onCancel: () => void
  onSubmit: (value: LinkEditorSubmitValue) => void | Promise<void>
  onRequestMetadata?: (url: string) => LinkMetadata | Promise<LinkMetadata>
}

interface LinkDraft {
  name: string
  url: string
  description: string
  icon: string
}

type LinkField = keyof LinkDraft
type EditorField = LinkField | 'categoryId'
type FieldErrors = Partial<Record<EditorField, string>>

function toDraft(value?: LinkEditorValue): LinkDraft {
  return {
    name: value?.name ?? '',
    url: value?.url ?? '',
    description: value?.description ?? '',
    icon: value?.icon ?? '',
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname.length > 0
  } catch {
    return false
  }
}

function validateDraft(draft: LinkDraft): { errors: FieldErrors; value?: LinkEditorValue } {
  const name = draft.name.trim()
  const url = draft.url.trim()
  const description = draft.description.trim()
  const icon = draft.icon.trim()
  const errors: FieldErrors = {}

  if (!name) errors.name = '请输入网站名称。'
  else if (name.length > NAME_LIMIT) errors.name = `网站名称不能超过 ${NAME_LIMIT} 个字符。`

  if (!url) errors.url = '请输入网站 URL。'
  else if (url.length > URL_LIMIT || !isHttpUrl(url)) {
    errors.url = '请输入完整的 http:// 或 https:// 地址。'
  }

  if (description.length > DESCRIPTION_LIMIT) {
    errors.description = `描述不能超过 ${DESCRIPTION_LIMIT} 个字符。`
  }
  if (icon && (icon.length > URL_LIMIT || !isHttpUrl(icon))) {
    errors.icon = '图标 URL 仅支持完整的 http:// 或 https:// 地址。'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return {
    errors,
    value: {
      name,
      url,
      description,
      ...(icon ? { icon } : {}),
    },
  }
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  )
}

export function LinkEditorDialog({
  open,
  mode = 'create',
  initialValue,
  busy = false,
  error,
  categories,
  selectedCategoryId = '',
  onSelectedCategoryIdChange,
  onCancel,
  onSubmit,
  onRequestMetadata,
}: LinkEditorDialogProps) {
  const id = useId()
  const titleId = `${id}-title`
  const descriptionId = `${id}-dialog-description`
  const dialogRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const fieldRefs = useRef<Record<LinkField, HTMLInputElement | null>>({
    name: null,
    url: null,
    description: null,
    icon: null,
  })
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const metadataRequestRef = useRef(0)
  const categoryFieldEnabled = categories !== undefined
  const initialName = initialValue?.name ?? ''
  const initialUrl = initialValue?.url ?? ''
  const initialDescription = initialValue?.description ?? ''
  const initialIcon = initialValue?.icon ?? ''
  const [draft, setDraft] = useState<LinkDraft>(() => toDraft(initialValue))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [metadataError, setMetadataError] = useState('')
  const interactionBlocked = busy || submitting
  const submitBlocked = interactionBlocked || metadataLoading

  useEffect(() => {
    if (!open) {
      metadataRequestRef.current += 1
      return
    }
    setDraft({
      name: initialName,
      url: initialUrl,
      description: initialDescription,
      icon: initialIcon,
    })
    setFieldErrors({})
    setSubmitError('')
    setMetadataError('')
    setMetadataLoading(false)
  }, [
    initialDescription,
    initialIcon,
    initialName,
    initialUrl,
    open,
  ])

  useEffect(() => {
    if (!open) return

    const activeElement = document.activeElement
    returnFocusRef.current =
      activeElement instanceof HTMLElement && activeElement.isConnected ? activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => nameRef.current?.focus())

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

  const updateField = (field: LinkField) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setDraft((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError('')
    if (field === 'url') setMetadataError('')
  }

  const focusFirstError = (errors: FieldErrors) => {
    const firstInvalid = (['name', 'url', 'description', 'icon', 'categoryId'] as const).find(
      (field) => errors[field],
    )
    if (!firstInvalid) return
    if (firstInvalid === 'categoryId') categoryRef.current?.focus()
    else fieldRefs.current[firstInvalid]?.focus()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitBlocked) return

    const validation = validateDraft(draft)
    const errors = { ...validation.errors }
    let categoryId: NavCategoryV2['id'] | undefined
    if (categoryFieldEnabled) {
      if (!selectedCategoryId) {
        errors.categoryId = '请选择所属分类。'
      } else if (!categories.some((category) => category.id === selectedCategoryId)) {
        errors.categoryId = '所选分类已不存在，请重新选择。'
      } else {
        categoryId = selectedCategoryId
      }
    }
    setFieldErrors(errors)
    if (!validation.value || Object.keys(errors).length > 0) {
      focusFirstError(errors)
      return
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({
        ...validation.value,
        ...(categoryId ? { categoryId } : {}),
      })
    } catch {
      setSubmitError('保存失败，请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMetadataRequest = async () => {
    if (!onRequestMetadata || metadataLoading || interactionBlocked) return
    const url = draft.url.trim()
    if (!isHttpUrl(url) || url.length > URL_LIMIT) {
      const errors = { ...fieldErrors, url: '请输入完整的 http:// 或 https:// 地址。' }
      setFieldErrors(errors)
      fieldRefs.current.url?.focus()
      return
    }

    const requestId = metadataRequestRef.current + 1
    metadataRequestRef.current = requestId
    setMetadataLoading(true)
    setMetadataError('')
    try {
      const metadata = await onRequestMetadata(url)
      if (metadataRequestRef.current !== requestId) return
      setDraft((current) => ({
        ...current,
        ...(metadata.name?.trim()
          ? { name: metadata.name.trim().slice(0, NAME_LIMIT) }
          : {}),
        ...(metadata.description?.trim()
          ? { description: metadata.description.trim().slice(0, DESCRIPTION_LIMIT) }
          : {}),
        ...(metadata.icon?.trim()
          ? { icon: metadata.icon.trim().slice(0, URL_LIMIT) }
          : {}),
      }))
      setFieldErrors((current) => ({
        ...current,
        name: undefined,
        description: undefined,
        icon: undefined,
      }))
    } catch {
      if (metadataRequestRef.current === requestId) {
        setMetadataError('无法识别网站信息，你仍可手动填写。')
      }
    } finally {
      if (metadataRequestRef.current === requestId) setMetadataLoading(false)
    }
  }

  if (!open) return null

  const title = mode === 'edit' ? '编辑网站' : '新增网站'
  const submitLabel = mode === 'edit' ? '保存修改' : '保存网站'
  const visibleSubmitError = error || submitError
  const fieldDescription = (field: EditorField, hintId?: string) => {
    const values = [hintId, fieldErrors[field] ? `${id}-${field}-error` : undefined].filter(Boolean)
    return values.length > 0 ? values.join(' ') : undefined
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        ref={dialogRef}
        className="dialog-panel link-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={submitBlocked || undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div className="dialog-copy">
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>填写网站名称和完整网址。不会自动补全或访问该网址。</p>
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="关闭链接编辑器"
            disabled={interactionBlocked}
            onClick={requestCancel}
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <form className="link-editor-form" noValidate onSubmit={(event) => { void handleSubmit(event) }}>
          <div className="form-field">
            <label htmlFor={`${id}-name`}>名称</label>
            <input
              ref={(element) => {
                nameRef.current = element
                fieldRefs.current.name = element
              }}
              id={`${id}-name`}
              name="name"
              type="text"
              maxLength={NAME_LIMIT}
              autoComplete="off"
              value={draft.name}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldDescription('name')}
              disabled={interactionBlocked}
              onChange={updateField('name')}
            />
            {fieldErrors.name && (
              <span id={`${id}-name-error`} className="field-error">{fieldErrors.name}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={`${id}-url`}>URL</label>
            <div className="link-editor-url-row">
              <input
                ref={(element) => {
                  fieldRefs.current.url = element
                }}
                id={`${id}-url`}
                name="url"
                type="text"
                inputMode="url"
                maxLength={URL_LIMIT}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://example.com"
                value={draft.url}
                aria-invalid={Boolean(fieldErrors.url)}
                aria-describedby={fieldDescription(
                  'url',
                  onRequestMetadata ? `${id}-metadata-hint` : undefined,
                )}
                disabled={interactionBlocked}
                onChange={updateField('url')}
              />
              {onRequestMetadata && (
                <button
                  type="button"
                  className="btn btn-secondary link-editor-metadata-button"
                  disabled={interactionBlocked || metadataLoading}
                  onClick={() => { void handleMetadataRequest() }}
                >
                  <Sparkles aria-hidden="true" size={17} />
                  {metadataLoading ? '正在识别' : '识别网站信息'}
                </button>
              )}
            </div>
            {onRequestMetadata && (
              <small id={`${id}-metadata-hint`}>
                仅在点击“识别网站信息”后，才会调用上层配置的元数据服务。
              </small>
            )}
            {fieldErrors.url && (
              <span id={`${id}-url-error`} className="field-error">{fieldErrors.url}</span>
            )}
            {metadataError && <span className="field-error" role="alert">{metadataError}</span>}
          </div>

          <div className="form-field">
            <label htmlFor={`${id}-description`}>描述</label>
            <input
              ref={(element) => {
                fieldRefs.current.description = element
              }}
              id={`${id}-description`}
              name="description"
              type="text"
              maxLength={DESCRIPTION_LIMIT}
              value={draft.description}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={fieldDescription('description')}
              disabled={interactionBlocked}
              onChange={updateField('description')}
            />
            {fieldErrors.description && (
              <span id={`${id}-description-error`} className="field-error">
                {fieldErrors.description}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor={`${id}-icon`}>图标 URL（可选）</label>
            <input
              ref={(element) => {
                fieldRefs.current.icon = element
              }}
              id={`${id}-icon`}
              name="icon"
              type="text"
              inputMode="url"
              maxLength={URL_LIMIT}
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="https://example.com/favicon.png"
              value={draft.icon}
              aria-invalid={Boolean(fieldErrors.icon)}
              aria-describedby={fieldDescription('icon')}
              disabled={interactionBlocked}
              onChange={updateField('icon')}
            />
            {fieldErrors.icon && (
              <span id={`${id}-icon-error`} className="field-error">{fieldErrors.icon}</span>
            )}
          </div>

          {categoryFieldEnabled && (
            <div className="form-field">
              <label htmlFor={`${id}-category`}>所属分类</label>
              <select
                ref={categoryRef}
                id={`${id}-category`}
                name="categoryId"
                value={selectedCategoryId}
                aria-invalid={Boolean(fieldErrors.categoryId)}
                aria-describedby={fieldDescription('categoryId')}
                disabled={interactionBlocked || !onSelectedCategoryIdChange}
                onChange={(event) => {
                  onSelectedCategoryIdChange?.(event.target.value as NavCategoryV2['id'] | '')
                  setFieldErrors((current) => {
                    if (!current.categoryId) return current
                    const next = { ...current }
                    delete next.categoryId
                    return next
                  })
                  setSubmitError('')
                }}
              >
                <option value="">请选择分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <span id={`${id}-categoryId-error`} className="field-error">
                  {fieldErrors.categoryId}
                </span>
              )}
            </div>
          )}

          {visibleSubmitError && <div className="dialog-error" role="alert">{visibleSubmitError}</div>}

          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-secondary dialog-button dialog-button-cancel"
              disabled={interactionBlocked}
              onClick={requestCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn dialog-button dialog-button-confirm"
              disabled={submitBlocked}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
