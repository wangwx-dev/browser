import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, Cloud, HardDrive } from 'lucide-react'

import { useWorkspaceActions, useWorkspaceState } from '../contexts/WorkspaceContext'
import type { NavConfigV2 } from '../types/workspace'

const FOCUSABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function documentSummary(document: NavConfigV2 | null): string {
  if (!document) return '云端当前没有工作区数据'
  const sites = document.categories.reduce((total, category) => total + category.links.length, 0)
  return `${document.categories.length} 个分类 · ${sites} 个网站 · revision ${document.revision}`
}

function formatTime(value: string | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function ConflictDialog() {
  const state = useWorkspaceState()
  const actions = useWorkspaceActions()
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const deferRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState<'local' | 'remote' | null>(null)
  const [error, setError] = useState('')
  const conflict = state.status.tag === 'conflict' && !state.status.deferred ? state.status : null

  useEffect(() => {
    if (!conflict) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => deferRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      const target = returnFocusRef.current
      requestAnimationFrame(() => target?.isConnected && target.focus())
    }
  }, [conflict])

  if (!conflict) return null

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      actions.deferConflict()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const keepLocal = () => {
    if (busy) return
    setBusy('local')
    setError('')
    if (!actions.keepLocalVersion()) {
      setBusy(null)
      setError('无法提交本机版本，当前内容保持不变。')
    }
  }

  const acceptRemote = async () => {
    if (busy) return
    setBusy('remote')
    setError('')
    if (!await actions.useRemoteVersion()) {
      setBusy(null)
      setError('无法先备份本机版本，因此没有切换到云端版本。')
    }
  }

  return (
    <div className="dialog-backdrop conflict-dialog-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="dialog-panel conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={Boolean(busy) || undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <header className="conflict-dialog-heading">
          <AlertTriangle aria-hidden="true" size={22} />
          <div>
            <h2 id={titleId}>选择要保留的工作区版本</h2>
            <p id={descriptionId}>检测到其他设备或标签页已更新云端。选择前，本机和云端内容都不会被覆盖。</p>
          </div>
        </header>

        <div className="conflict-versions">
          <article>
            <HardDrive aria-hidden="true" size={20} />
            <div><strong>本机版本</strong><span>{documentSummary(conflict.local)}</span><small>{formatTime(conflict.local.updatedAt)}</small></div>
          </article>
          <article>
            <Cloud aria-hidden="true" size={20} />
            <div><strong>云端版本</strong><span>{documentSummary(conflict.remote)}</span><small>{formatTime(conflict.remote?.updatedAt)}</small></div>
          </article>
        </div>

        <p className="conflict-backup-note">选择“使用云端”前，会先把完整本机版本写入 IndexedDB 冲突备份。</p>
        {error && <div className="dialog-error" role="alert">{error}</div>}

        <div className="dialog-actions conflict-dialog-actions">
          <button ref={deferRef} type="button" className="btn btn-secondary dialog-button" disabled={Boolean(busy)} onClick={actions.deferConflict}>
            稍后处理
          </button>
          <button type="button" className="btn btn-secondary dialog-button" disabled={Boolean(busy)} onClick={() => { void acceptRemote() }}>
            {busy === 'remote' ? '正在备份…' : '使用云端'}
          </button>
          <button type="button" className="btn dialog-button dialog-button-confirm" disabled={Boolean(busy)} onClick={keepLocal}>
            {busy === 'local' ? '正在提交…' : '保留本机'}
          </button>
        </div>
      </section>
    </div>
  )
}
