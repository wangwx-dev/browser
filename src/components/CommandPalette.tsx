import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  ArrowRight,
  Compass,
  FileQuestion,
  LoaderCircle,
  Search,
  TerminalSquare,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { TOOL_REGISTRY } from '../config/tools'
import { useWorkspaceActions, useWorkspaceState } from '../contexts/WorkspaceContext'
import { OPEN_COMMAND_PALETTE_EVENT } from '../domain/command-palette'
import { executeCommand } from '../domain/command-execution'
import {
  buildCommandIndex,
  buildRankingContext,
  commandKeyForRef,
  normalizeSearchQuery,
  searchCommands,
  type SearchCommand,
  type SearchHit,
} from '../domain/search'

interface PaletteEntry {
  command: SearchCommand
  section: string
  match?: SearchHit['match']
}

interface PaletteGroup {
  section: string
  entries: PaletteEntry[]
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.matches('input, textarea, select')) return true
  if (target instanceof HTMLElement && target.isContentEditable) return true

  let current: Element | null = target
  while (current) {
    if (current.hasAttribute('contenteditable')) {
      const mode = current.getAttribute('contenteditable')?.trim().toLowerCase()
      if (mode === 'false') return false
      if (mode === '' || mode === 'true' || mode === 'plaintext-only') return true
    }
    current = current.parentElement
  }
  return false
}

function isEditableKeyboardEvent(event: KeyboardEvent): boolean {
  const candidates = [event.target, document.activeElement, ...event.composedPath()]
  return candidates.some(isEditableElement)
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  )
}

function optionIdFor(key: string): string {
  return `command-${key.replace(/[^a-z0-9-]/gi, '-')}`
}

function groupEntries(entries: readonly PaletteEntry[]): PaletteGroup[] {
  const groups: PaletteGroup[] = []
  entries.forEach((entry) => {
    const current = groups.at(-1)
    if (current?.section === entry.section) {
      current.entries.push(entry)
    } else {
      groups.push({ section: entry.section, entries: [entry] })
    }
  })
  return groups
}

function matchSummary(entry: PaletteEntry): string {
  if (!entry.match) return entry.command.category || entry.command.description
  const labels: Record<SearchHit['match']['field'], string> = {
    alias: '别名',
    category: '分类',
    description: '描述',
    keyword: '关键词',
    title: '名称',
    url: '网址',
  }
  const detail = entry.command.description || entry.command.category || entry.command.searchableUrl
  return `命中${labels[entry.match.field]}${detail ? ` · ${detail}` : ''}`
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { document: workspaceDocument, ready } = useWorkspaceState()
  const { recordRecent } = useWorkspaceActions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [rankingNow, setRankingNow] = useState(() => Date.now())
  const [showSearching, setShowSearching] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const deferredQuery = useDeferredValue(query)
  const normalizedQuery = normalizeSearchQuery(query)
  const normalizedDeferredQuery = normalizeSearchQuery(deferredQuery)
  const searchPending = normalizedQuery !== normalizedDeferredQuery

  const index = useMemo(
    () => buildCommandIndex({ tools: TOOL_REGISTRY, categories: workspaceDocument?.categories ?? [] }),
    [workspaceDocument?.categories],
  )
  const context = useMemo(
    () =>
      buildRankingContext({
        favorites: workspaceDocument?.favorites,
        recents: workspaceDocument?.recents,
        now: rankingNow,
      }),
    [rankingNow, workspaceDocument?.favorites, workspaceDocument?.recents],
  )

  const emptyEntries = useMemo<PaletteEntry[]>(() => {
    if (!workspaceDocument) return []
    const byKey = new Map(index.commands.map((command) => [command.key, command]))
    const seen = new Set<string>()
    const entries: PaletteEntry[] = []
    const add = (command: SearchCommand | undefined, section: string): boolean => {
      if (!command || seen.has(command.key)) return false
      seen.add(command.key)
      entries.push({ command, section })
      return true
    }
    const addRefs = (
      refs: readonly { ref: Parameters<typeof commandKeyForRef>[0] }[],
      section: string,
      limit: number,
    ) => {
      let added = 0
      for (const item of refs) {
        if (add(byKey.get(commandKeyForRef(item.ref)), section)) added += 1
        if (added === limit) break
      }
    }

    addRefs(workspaceDocument.favorites, '收藏', 8)
    addRefs(workspaceDocument.recents, '最近使用', 10)
    let commonToolCount = 0
    for (const command of index.commands) {
      if (command.kind !== 'tool') continue
      if (add(command, '常用工具')) commonToolCount += 1
      if (commonToolCount === 6) break
    }
    return entries
  }, [index.commands, workspaceDocument])

  const entries = useMemo<PaletteEntry[]>(() => {
    if (normalizedDeferredQuery.length === 0) return emptyEntries
    return searchCommands(index, deferredQuery, context)
      .slice(0, 50)
      .map((hit) => ({ command: hit.command, match: hit.match, section: '搜索结果' }))
  }, [context, deferredQuery, emptyEntries, index, normalizedDeferredQuery])
  const groups = useMemo(() => groupEntries(entries), [entries])

  useEffect(() => {
    setActiveKey((current) => {
      if (current && entries.some((entry) => entry.command.key === current)) return current
      return entries[0]?.command.key ?? null
    })
  }, [entries])

  useEffect(() => {
    if (!open || !activeKey) return
    const frame = requestAnimationFrame(() => {
      const option = document.getElementById(optionIdFor(activeKey))
      option?.scrollIntoView?.({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [activeKey, open])

  useEffect(() => {
    if (!open || !searchPending) {
      setShowSearching(false)
      return
    }
    const timer = window.setTimeout(() => setShowSearching(true), 150)
    return () => window.clearTimeout(timer)
  }, [open, searchPending])

  useEffect(() => {
    const focusQuery = () => requestAnimationFrame(() => inputRef.current?.focus())
    const show = () => {
      if (openRef.current) {
        focusQuery()
        return
      }
      const activeElement = document.activeElement
      returnFocusRef.current =
        activeElement instanceof HTMLElement && activeElement.isConnected ? activeElement : null
      openRef.current = true
      setRankingNow(Date.now())
      setOpen(true)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
      if (isEditableKeyboardEvent(event)) return
      event.preventDefault()
      show()
    }
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, show)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, show)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  const close = () => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    setQuery('')
    setShowSearching(false)
    const returnTarget = returnFocusRef.current
    returnFocusRef.current = null
    requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus()
    })
  }

  const execute = async (command: SearchCommand) => {
    const succeeded = await executeCommand(command, { navigate, recordRecent })
    if (succeeded) close()
  }

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key === 'Tab') {
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = focusableElements(dialog)
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) {
        event.preventDefault()
        return
      }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }
    if (event.target !== inputRef.current) return
    if (event.key === 'Enter' && searchPending) {
      event.preventDefault()
      return
    }
    if (entries.length === 0) return

    const currentIndex = entries.findIndex((entry) => entry.command.key === activeKey)
    let nextIndex: number | undefined
    if (event.key === 'ArrowDown') {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % entries.length
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex <= 0 ? entries.length - 1 : currentIndex - 1
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = entries.length - 1
    }
    if (nextIndex !== undefined) {
      event.preventDefault()
      setActiveKey(entries[nextIndex].command.key)
      return
    }
    if (event.key === 'Enter' && activeKey) {
      event.preventDefault()
      const entry = entries.find((candidate) => candidate.command.key === activeKey)
      if (entry) void execute(entry.command)
    }
  }

  if (!open) return null

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={close}>
      <section
        ref={dialogRef}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="命令面板"
        onKeyDown={onDialogKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-input-row">
          <Search aria-hidden="true" size={20} />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="搜索网站、工具或命令"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={ready && activeKey ? optionIdFor(activeKey) : undefined}
            value={query}
            placeholder="搜索网站、工具或命令…"
            onChange={(event) => setQuery(event.target.value)}
          />
          {showSearching && (
            <span className="command-searching" role="status" aria-label="正在搜索">
              <LoaderCircle aria-hidden="true" size={17} />
            </span>
          )}
          {query && (
            <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}>
              <X aria-hidden="true" size={19} />
            </button>
          )}
          <button type="button" aria-label="关闭命令面板" onClick={close}>
            <X aria-hidden="true" size={19} />
          </button>
        </div>

        <div
          id="command-results"
          className="command-results"
          role="listbox"
          aria-label="命令结果"
          aria-busy={showSearching || undefined}
        >
          {!ready ? (
            <div className="command-empty" aria-busy="true">正在载入工作区…</div>
          ) : entries.length === 0 ? (
            <div className="command-empty">
              <FileQuestion aria-hidden="true" size={28} />
              <strong>没有找到匹配项</strong>
              <span>可以清除搜索，或前往导航页新增网站。</span>
              <div>
                <button type="button" onClick={() => setQuery('')}>清除搜索</button>
                <button type="button" onClick={() => { close(); navigate('/navigation?add=site') }}>
                  新增网站
                </button>
              </div>
            </div>
          ) : (
            groups.map((group, groupIndex) => {
              const headingId = `command-section-${groupIndex}`
              return (
                <div
                  key={group.section}
                  className="command-result-group"
                  role="group"
                  aria-labelledby={headingId}
                >
                  <div id={headingId} className="command-section-title">{group.section}</div>
                  {group.entries.map((entry) => {
                    const active = entry.command.key === activeKey
                    const Icon = entry.command.kind === 'tool' ? TerminalSquare : Compass
                    return (
                      <button
                        id={optionIdFor(entry.command.key)}
                        key={entry.command.key}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        aria-selected={active}
                        className={`command-result ${active ? 'active' : ''}`}
                        onMouseEnter={() => setActiveKey(entry.command.key)}
                        onClick={() => { void execute(entry.command) }}
                      >
                        <Icon aria-hidden="true" size={20} />
                        <span className="command-result-copy">
                          <strong>{entry.command.title}</strong>
                          <small>{matchSummary(entry)}</small>
                        </span>
                        <span className="command-kind">{entry.command.kind === 'tool' ? '工具' : '网站'}</span>
                        <ArrowRight aria-hidden="true" size={17} />
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
        <footer className="command-palette-footer">↑↓ 选择 · Enter 打开 · Esc 关闭</footer>
      </section>
    </div>
  )
}
