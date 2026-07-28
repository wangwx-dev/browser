import { Clock3, CloudOff, Compass, Search, Star, TerminalSquare } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { TOOL_REGISTRY } from '../config/tools'
import { SyncStatus } from '../components/SyncStatus'
import { useAuth } from '../contexts/useAuth'
import {
  useWorkspaceActions,
  useWorkspaceState,
} from '../contexts/WorkspaceContext'
import { openCommandPalette } from '../domain/command-palette'
import { executeCommand } from '../domain/command-execution'
import { buildCommandIndex, commandKeyForRef, type SearchCommand } from '../domain/search'
import type { ISODateTime, ResourceRefV2 } from '../types/workspace'

interface RecentCommand {
  command: SearchCommand
  openedAt: ISODateTime
}

function greetingForHour(hour: number): string {
  if (hour < 11) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function relativeTime(value: string, now = Date.now()): string {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return '时间未知'
  const elapsed = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (elapsed < minute) return '刚刚'
  if (elapsed < hour) return `${Math.floor(elapsed / minute)} 分钟前`
  if (elapsed < day) return `${Math.floor(elapsed / hour)} 小时前`
  return `${Math.floor(elapsed / day)} 天前`
}

function ResourceIcon({ kind }: { kind: SearchCommand['kind'] }) {
  return kind === 'tool' ? (
    <TerminalSquare aria-hidden="true" size={20} />
  ) : (
    <Compass aria-hidden="true" size={20} />
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const state = useWorkspaceState()
  const { recordRecent, removeResourceReferences, toggleFavorite } = useWorkspaceActions()
  const [cleanupNotice, setCleanupNotice] = useState('')
  const cleanupAttemptedRef = useRef(new Set<string>())
  const document = state.document
  const index = useMemo(
    () => buildCommandIndex({ tools: TOOL_REGISTRY, categories: document?.categories ?? [] }),
    [document?.categories],
  )
  const byKey = useMemo(
    () => new Map(index.commands.map((command) => [command.key, command])),
    [index.commands],
  )
  const favoriteKeys = useMemo(
    () => new Set(document?.favorites.map((favorite) => commandKeyForRef(favorite.ref)) ?? []),
    [document?.favorites],
  )

  const favorites = useMemo(() => {
    const resolved: SearchCommand[] = []
    const seen = new Set<string>()
    for (const favorite of document?.favorites ?? []) {
      const key = commandKeyForRef(favorite.ref)
      const command = byKey.get(key)
      if (!command || seen.has(key)) continue
      seen.add(key)
      resolved.push(command)
      if (resolved.length === 8) break
    }
    return resolved
  }, [byKey, document?.favorites])

  const recents = useMemo(() => {
    const resolved = new Map<string, RecentCommand>()
    for (const recent of document?.recents ?? []) {
      const key = commandKeyForRef(recent.ref)
      const command = byKey.get(key)
      if (!command) continue
      const previous = resolved.get(key)
      if (!previous || Date.parse(recent.openedAt) > Date.parse(previous.openedAt)) {
        resolved.set(key, { command, openedAt: recent.openedAt })
      }
    }
    return [...resolved.values()]
      .sort(
        (left, right) =>
          Date.parse(right.openedAt) - Date.parse(left.openedAt) ||
          left.command.key.localeCompare(right.command.key, 'en'),
      )
      .slice(0, 10)
  }, [byKey, document?.recents])

  const commonTools = useMemo(() => {
    const resolved: SearchCommand[] = []
    const seen = new Set<string>()
    const add = (command: SearchCommand | undefined) => {
      if (!command || command.kind !== 'tool' || seen.has(command.key)) return
      seen.add(command.key)
      resolved.push(command)
    }
    const recentTools = [...(document?.recents ?? [])].sort(
      (left, right) => Date.parse(right.openedAt) - Date.parse(left.openedAt),
    )
    recentTools.forEach((recent) => add(byKey.get(commandKeyForRef(recent.ref))))
    for (const command of index.commands) {
      add(command)
      if (resolved.length === 6) break
    }
    return resolved.slice(0, 6)
  }, [byKey, document?.recents, index.commands])

  const staleRefs = useMemo(() => {
    const stale = new Map<string, ResourceRefV2>()
    const collect = (ref: ResourceRefV2) => {
      const key = commandKeyForRef(ref)
      if (!byKey.has(key)) stale.set(key, ref)
    }
    document?.favorites.forEach((favorite) => collect(favorite.ref))
    document?.recents.forEach((recent) => collect(recent.ref))
    return [...stale.entries()]
  }, [byKey, document?.favorites, document?.recents])

  useEffect(() => {
    let cleaned = 0
    staleRefs.forEach(([key, ref]) => {
      if (cleanupAttemptedRef.current.has(key)) return
      cleanupAttemptedRef.current.add(key)
      if (removeResourceReferences(ref)) cleaned += 1
    })
    if (cleaned > 0) setCleanupNotice(`已清理 ${cleaned} 条失效引用`)
  }, [removeResourceReferences, staleRefs])

  const execute = async (command: SearchCommand) => {
    await executeCommand(command, { navigate, recordRecent })
  }

  if (state.status.tag === 'fatal' && !document) {
    return (
      <section className="workspace-unavailable" role="alert">
        <CloudOff aria-hidden="true" size={28} />
        <h1>无法载入个人工作区</h1>
        <p>{state.status.error.message}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>重新载入</button>
      </section>
    )
  }

  if (!state.ready || !document) {
    return (
      <div className="dashboard dashboard-loading" aria-busy="true" aria-label="正在载入工作台">
        <div className="dashboard-skeleton dashboard-skeleton-title" />
        <div className="dashboard-skeleton dashboard-skeleton-search" />
        {Array.from({ length: 3 }, (_, section) => (
          <div key={section} className="dashboard-skeleton-section">
            <div className="dashboard-skeleton dashboard-skeleton-heading" />
            <div className="dashboard-skeleton-grid">
              {Array.from({ length: 4 }, (_, card) => (
                <div key={card} className="dashboard-skeleton dashboard-skeleton-card" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const displayName = user?.email?.split('@')[0] || '开发者'
  return (
    <div className="dashboard page-container">
      <section className="dashboard-welcome">
        <div>
          <p>{greetingForHour(new Date().getHours())}，{displayName}</p>
          <h1>今天想打开什么？</h1>
        </div>
        <SyncStatus compact />
      </section>

      {cleanupNotice && <div className="dashboard-cleanup-notice" role="status">{cleanupNotice}</div>}

      <button
        type="button"
        className="dashboard-search"
        aria-label="搜索网站、工具或命令"
        aria-haspopup="dialog"
        onClick={openCommandPalette}
      >
        <Search aria-hidden="true" size={22} />
        <span>搜索网站、工具或命令…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <section className="dashboard-section" aria-labelledby="favorites-title">
        <div className="dashboard-section-heading">
          <h2 id="favorites-title"><Star aria-hidden="true" size={19} />收藏</h2>
          <span>{favorites.length}/8</span>
        </div>
        {favorites.length === 0 ? (
          <div className="dashboard-empty">
            <Star aria-hidden="true" size={24} />
            <div><strong>把常用网站或工具固定到这里</strong><span>打开工具或导航后即可收藏。</span></div>
            <button type="button" onClick={openCommandPalette}>浏览工具</button>
          </div>
        ) : (
          <div className="resource-grid favorite-grid">
            {favorites.map((command) => (
              <article key={command.key} className="resource-card">
                <button type="button" className="resource-open" onClick={() => { void execute(command) }}>
                  <ResourceIcon kind={command.kind} />
                  <span><strong>{command.title}</strong><small>{command.kind === 'tool' ? '工具' : command.category}</small></span>
                </button>
                <button
                  type="button"
                  className="favorite-toggle active"
                  aria-label={`取消收藏 ${command.title}`}
                  onClick={() => toggleFavorite(command.ref)}
                >
                  <Star aria-hidden="true" size={17} fill="currentColor" />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="recents-title">
        <div className="dashboard-section-heading">
          <h2 id="recents-title"><Clock3 aria-hidden="true" size={19} />最近使用</h2>
        </div>
        {recents.length === 0 ? (
          <div className="dashboard-empty">
            <Clock3 aria-hidden="true" size={24} />
            <div><strong>打开过的内容会出现在这里</strong><span>最近记录只保存资源和时间。</span></div>
            <button type="button" onClick={openCommandPalette}>开始搜索</button>
          </div>
        ) : (
          <div className="recent-list">
            {recents.map(({ command, openedAt }) => (
              <button key={command.key} type="button" onClick={() => { void execute(command) }}>
                <ResourceIcon kind={command.kind} />
                <span><strong>{command.title}</strong><small>{command.kind === 'tool' ? '工具' : '网站'}</small></span>
                <time dateTime={openedAt}>{relativeTime(openedAt)}</time>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section" aria-labelledby="tools-title">
        <div className="dashboard-section-heading">
          <h2 id="tools-title"><TerminalSquare aria-hidden="true" size={19} />常用工具</h2>
        </div>
        <div className="resource-grid tool-grid">
          {commonTools.map((command) => (
            <article key={command.key} className="resource-card">
              <button type="button" className="resource-open" onClick={() => { void execute(command) }}>
                <ResourceIcon kind={command.kind} />
                <span><strong>{command.title}</strong><small>{command.category}</small></span>
              </button>
              <button
                type="button"
                className={`favorite-toggle ${favoriteKeys.has(command.key) ? 'active' : ''}`}
                aria-label={`${favoriteKeys.has(command.key) ? '取消收藏' : '收藏'} ${command.title}`}
                onClick={() => toggleFavorite(command.ref)}
              >
                <Star aria-hidden="true" size={17} fill={favoriteKeys.has(command.key) ? 'currentColor' : 'none'} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section" aria-labelledby="sites-title">
        <div className="dashboard-section-heading">
          <h2 id="sites-title"><Compass aria-hidden="true" size={19} />导航分组</h2>
          <Link to="/navigation">管理导航</Link>
        </div>
        {document.categories.map((category) => (
          <div key={category.id} className="dashboard-category">
            <h3>{category.name}<span>{category.links.length}</span></h3>
            <div className="resource-grid site-grid">
              {category.links.map((link) => {
                const command = byKey.get(`site:${link.id}`)
                if (!command) return null
                return (
                  <article key={link.id} className="resource-card">
                    <button type="button" className="resource-open" onClick={() => { void execute(command) }}>
                      <Compass aria-hidden="true" size={20} />
                      <span><strong>{link.name}</strong><small>{link.description || new URL(link.url).hostname}</small></span>
                    </button>
                    <button
                      type="button"
                      className={`favorite-toggle ${favoriteKeys.has(command.key) ? 'active' : ''}`}
                      aria-label={`${favoriteKeys.has(command.key) ? '取消收藏' : '收藏'} ${link.name}`}
                      onClick={() => toggleFavorite(command.ref)}
                    >
                      <Star aria-hidden="true" size={17} fill={favoriteKeys.has(command.key) ? 'currentColor' : 'none'} />
                    </button>
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
