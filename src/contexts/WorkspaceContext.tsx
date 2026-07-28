/* oxlint-disable react/only-export-components -- Provider, typed hooks and selectors form one context API. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { normalizeNavConfig, serializeNavConfigV2 } from '../domain/nav-config'
import type {
  RemoteLoadResult,
  RemoteSaveResult,
  WorkspaceRepository,
  WorkspaceRepositoryError,
} from '../services/workspace-repository'
import {
  createWorkspaceStorage,
  type WorkspaceConflictBackup,
  type WorkspaceDraft,
  type WorkspaceStorage,
} from '../services/workspace-storage'
import type {
  ISODateTime,
  LegacyShadow,
  NavConfigV2,
  ResourceRefV2,
  UUID,
} from '../types/workspace'

export interface WorkspaceError {
  code:
    | 'AUTH_EXPIRED'
    | 'CONFIG_INVALID'
    | 'DATA_INVALID'
    | 'FORBIDDEN'
    | 'LOCAL_STORAGE_FAILED'
    | 'NETWORK'
    | 'REMOTE_CONFLICT'
    | 'UNKNOWN'
  message: string
}

export type WorkspaceSyncState =
  | { tag: 'booting' }
  | { tag: 'loading'; cached: boolean }
  | { tag: 'synced'; remoteVersion: string | null }
  | { tag: 'dirty'; localRevision: number }
  | { tag: 'writerDisabled'; localRevision: number }
  | { tag: 'syncing'; attempt: number; mutationId: UUID }
  | { tag: 'offline'; attempt: number }
  | { tag: 'retryWait'; attempt: number; retryAt: number }
  | { tag: 'failed'; error: WorkspaceError }
  | {
      tag: 'conflict'
      local: NavConfigV2
      remote: NavConfigV2 | null
      remoteVersion: string | null
      deferred: boolean
    }
  | { tag: 'fatal'; error: WorkspaceError }

export interface WorkspaceState {
  userId: string
  document: NavConfigV2 | null
  legacyShadow?: LegacyShadow
  baseRemoteVersion: string | null
  mutationId: UUID | null
  status: WorkspaceSyncState
  ready: boolean
  readOnly: boolean
  remoteWriteEnabled: boolean
  pendingLocalWrites: number
}

export type WorkspaceMutation = (
  document: NavConfigV2,
  metadata: { now: ISODateTime },
) => NavConfigV2

export interface WorkspaceActions {
  commit: (mutation: WorkspaceMutation) => boolean
  toggleFavorite: (ref: ResourceRefV2) => boolean
  recordRecent: (ref: ResourceRefV2, openedAt?: ISODateTime) => boolean
  removeResourceReferences: (ref: ResourceRefV2) => boolean
  retryLocalSave: () => boolean
  retrySync: () => boolean
  keepLocalVersion: () => boolean
  useRemoteVersion: () => Promise<boolean>
  deferConflict: () => boolean
  reopenConflict: () => boolean
}

export interface WorkspaceProviderProps {
  userId: string
  children: ReactNode
  storage?: WorkspaceStorage
  repository?: WorkspaceRepository
  remoteWriterEnabled?: boolean
  initialDocument?: NavConfigV2
  initialLegacyShadow?: LegacyShadow
  now?: () => string
  newId?: () => string
  retryDelaysMs?: readonly number[]
}

const DEFAULT_RETRY_DELAYS = [1_000, 3_000, 10_000, 30_000] as const
const WorkspaceStateContext = createContext<WorkspaceState | null>(null)
const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null)

function defaultNow(): string {
  return new Date().toISOString()
}

function defaultNewId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('crypto.randomUUID is unavailable in this runtime.')
  }
  return globalThis.crypto.randomUUID()
}

function asCanonicalTime(value: string): ISODateTime {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError('Workspace timestamps must be canonical UTC ISO strings.')
  }
  return value as ISODateTime
}

function asUuid(value: string): UUID {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TypeError('Workspace mutation IDs must be RFC 4122 UUIDs.')
  }
  return value as UUID
}

function createEmptyDocument(now: ISODateTime, configId: UUID): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId,
    revision: 1,
    updatedAt: now,
    categories: [],
    favorites: [],
    recents: [],
  }
}

function sameRef(left: ResourceRefV2, right: ResourceRefV2): boolean {
  return left.kind === right.kind && left.id === right.id
}

function toWorkspaceError(error: unknown): WorkspaceError {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'DATA_INVALID'
  ) {
    return { code: 'DATA_INVALID', message: '本机工作区数据无效，未覆盖现有内容。' }
  }
  return { code: 'LOCAL_STORAGE_FAILED', message: '无法安全保存到本机，请重试或导出数据。' }
}

function repositoryError(error: WorkspaceRepositoryError): WorkspaceError {
  return {
    code: error.code,
    message: error.message,
  }
}

function remoteFailure(result: RemoteLoadResult | RemoteSaveResult): WorkspaceError {
  switch (result.kind) {
    case 'unauthorized':
      return { code: 'AUTH_EXPIRED', message: '登录状态已过期，请重新登录。' }
    case 'forbidden':
    case 'retryable':
    case 'failed':
      return repositoryError(result.error)
    case 'invalid':
      return { code: 'DATA_INVALID', message: '云端工作区数据无效，未覆盖本机内容。' }
    default:
      return { code: 'UNKNOWN', message: '个人工作区请求失败，本机内容保持不变。' }
  }
}

function initialState(userId: string, remoteWriteEnabled: boolean): WorkspaceState {
  return {
    userId,
    document: null,
    baseRemoteVersion: null,
    mutationId: null,
    status: { tag: 'booting' },
    ready: false,
    readOnly: false,
    remoteWriteEnabled,
    pendingLocalWrites: 0,
  }
}

function unsyncedStatus(
  document: NavConfigV2,
  hasRepository: boolean,
  remoteWriterEnabled: boolean,
): WorkspaceSyncState {
  return hasRepository && !remoteWriterEnabled
    ? { tag: 'writerDisabled', localRevision: document.revision }
    : { tag: 'dirty', localRevision: document.revision }
}

function draftState(
  draft: WorkspaceDraft,
  options: { hasRepository: boolean; remoteWriterEnabled: boolean },
): WorkspaceState {
  return {
    userId: draft.userId,
    document: draft.document,
    ...(draft.legacyShadow ? { legacyShadow: draft.legacyShadow } : {}),
    baseRemoteVersion: draft.baseRemoteVersion,
    mutationId: draft.mutationId,
    status: draft.dirty
      ? unsyncedStatus(draft.document, options.hasRepository, options.remoteWriterEnabled)
      : { tag: 'synced', remoteVersion: draft.baseRemoteVersion },
    ready: true,
    readOnly: false,
    remoteWriteEnabled: options.remoteWriterEnabled,
    pendingLocalWrites: 0,
  }
}

export function WorkspaceProvider({
  userId,
  children,
  storage,
  repository,
  remoteWriterEnabled = false,
  initialDocument,
  initialLegacyShadow,
  now = defaultNow,
  newId = defaultNewId,
  retryDelaysMs = DEFAULT_RETRY_DELAYS,
}: WorkspaceProviderProps) {
  const resolvedStorage = useMemo(() => storage ?? createWorkspaceStorage(), [storage])
  const initialUserIdRef = useRef(userId)
  const initialDocumentRef = useRef(initialDocument)
  const initialLegacyShadowRef = useRef(initialLegacyShadow)
  const runtimeRef = useRef({ now, newId })
  runtimeRef.current = { now, newId }

  const [state, setState] = useState<WorkspaceState>(() => initialState(userId, remoteWriterEnabled))
  const stateRef = useRef(state)
  const generationRef = useRef(0)
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
  const remoteFlightGenerationRef = useRef<number | null>(null)
  const remoteSyncRequestedRef = useRef(false)
  const remoteAttemptRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)

  const publish = useCallback((next: WorkspaceState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
  }, [])

  useEffect(() => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    writeQueueRef.current = Promise.resolve()
    remoteFlightGenerationRef.current = null
    remoteSyncRequestedRef.current = false
    remoteAttemptRef.current = 0
    clearRetryTimer()
    let active = true
    publish({
      ...initialState(userId, remoteWriterEnabled),
      status: { tag: 'loading', cached: false },
    })

    const mayUseInitialData = initialUserIdRef.current === userId
    const localPromise = resolvedStorage.loadDraft(userId)
    const optimisticRemotePromise = repository
      ? repository.load({ userId }).catch(() => ({
          kind: 'retryable' as const,
          error: { code: 'NETWORK' as const, message: '暂时无法连接个人数据服务。', retryable: true },
        }))
      : undefined

    const initialize = async () => {
      let local: WorkspaceDraft | null
      try {
        local = await localPromise
      } catch (error) {
        if (!active || generationRef.current !== generation) return
        publish({
          ...initialState(userId, remoteWriterEnabled),
          status: { tag: 'fatal', error: toWorkspaceError(error) },
          ready: true,
          readOnly: true,
        })
        return
      }
      if (!active || generationRef.current !== generation) return

      if (!repository) {
        if (local) {
          publish(draftState(local, { hasRepository: false, remoteWriterEnabled: false }))
          return
        }
        try {
          const timestamp = asCanonicalTime(runtimeRef.current.now())
          const document = mayUseInitialData && initialDocumentRef.current
            ? serializeNavConfigV2(initialDocumentRef.current)
            : createEmptyDocument(timestamp, asUuid(runtimeRef.current.newId()))
          const legacyShadow = mayUseInitialData && initialLegacyShadowRef.current
            ? {
                sourceFingerprint: initialLegacyShadowRef.current.sourceFingerprint,
                document: serializeNavConfigV2(initialLegacyShadowRef.current.document),
              }
            : undefined
          const next: WorkspaceState = {
            userId,
            document,
            ...(legacyShadow ? { legacyShadow } : {}),
            baseRemoteVersion: null,
            mutationId: null,
            status: { tag: 'dirty', localRevision: document.revision },
            ready: true,
            readOnly: false,
            remoteWriteEnabled: false,
            pendingLocalWrites: 0,
          }
          await resolvedStorage.saveDraft({
            userId,
            document,
            ...(legacyShadow ? { legacyShadow } : {}),
            baseRemoteVersion: null,
            dirty: true,
            mutationId: null,
            savedAt: timestamp,
          })
          if (!active || generationRef.current !== generation) return
          publish(next)
        } catch (error) {
          if (!active || generationRef.current !== generation) return
          publish({
            ...initialState(userId, false),
            status: { tag: 'fatal', error: toWorkspaceError(error) },
            ready: true,
            readOnly: true,
          })
        }
        return
      }

      if (local) {
        publish({
          ...draftState(local, { hasRepository: true, remoteWriterEnabled }),
          status: { tag: 'loading', cached: true },
        })
      }

      let remote: RemoteLoadResult
      const shouldReloadWithLocalShadow = Boolean(local?.legacyShadow)
      try {
        remote = shouldReloadWithLocalShadow
          ? await repository.load({ userId, legacyShadow: local?.legacyShadow })
          : await (optimisticRemotePromise as Promise<RemoteLoadResult>)
      } catch {
        remote = {
          kind: 'retryable',
          error: { code: 'NETWORK', message: '暂时无法连接个人数据服务。', retryable: true },
        }
      }
      if (!active || generationRef.current !== generation) return

      const publishRemoteFailure = (error: WorkspaceError, offline = false) => {
        if (local) {
          publish({
            ...draftState(local, { hasRepository: true, remoteWriterEnabled }),
            status: offline ? { tag: 'offline', attempt: 1 } : { tag: 'failed', error },
          })
        } else {
          publish({
            ...initialState(userId, remoteWriterEnabled),
            status: { tag: 'fatal', error },
            ready: true,
            readOnly: true,
          })
        }
      }

      if (remote.kind === 'loaded') {
        const remoteDocument = remote.snapshot.document
        const remoteVersion = remote.snapshot.remoteVersion
        const localHasUserChanges = Boolean(
          local?.dirty && !(local.baseRemoteVersion === null && local.mutationId === null),
        )
        if (local && localHasUserChanges) {
          if (local.baseRemoteVersion === remoteVersion) {
            const next = {
              ...draftState(local, { hasRepository: true, remoteWriterEnabled }),
              ...(remote.legacyShadow ? { legacyShadow: remote.legacyShadow } : {}),
            }
            publish(next)
          } else {
            publish({
              ...draftState(local, { hasRepository: true, remoteWriterEnabled }),
              status: {
                tag: 'conflict',
                local: local.document,
                remote: remoteDocument,
                remoteVersion,
                deferred: false,
              },
            })
          }
          return
        }

        const timestamp = asCanonicalTime(runtimeRef.current.now())
        const next: WorkspaceState = {
          userId,
          document: remoteDocument,
          ...(remote.legacyShadow ? { legacyShadow: remote.legacyShadow } : {}),
          baseRemoteVersion: remoteVersion,
          mutationId: null,
          status: { tag: 'synced', remoteVersion },
          ready: true,
          readOnly: false,
          remoteWriteEnabled: remoteWriterEnabled,
          pendingLocalWrites: 0,
        }
        await resolvedStorage.saveDraft({
          userId,
          document: remoteDocument,
          ...(remote.legacyShadow ? { legacyShadow: remote.legacyShadow } : {}),
          baseRemoteVersion: remoteVersion,
          dirty: false,
          mutationId: null,
          savedAt: timestamp,
        })
        if (!active || generationRef.current !== generation) return
        publish(next)
        return
      }

      if (remote.kind === 'not-found') {
        try {
          const timestamp = asCanonicalTime(runtimeRef.current.now())
          const document = local?.document ?? (
            mayUseInitialData && initialDocumentRef.current
              ? serializeNavConfigV2(initialDocumentRef.current)
              : createEmptyDocument(timestamp, asUuid(runtimeRef.current.newId()))
          )
          const legacyShadow = local?.legacyShadow ?? (
            mayUseInitialData ? initialLegacyShadowRef.current : undefined
          )
          const next: WorkspaceState = {
            userId,
            document,
            ...(legacyShadow ? { legacyShadow } : {}),
            baseRemoteVersion: null,
            mutationId: local?.mutationId ?? null,
            status: unsyncedStatus(document, true, remoteWriterEnabled),
            ready: true,
            readOnly: false,
            remoteWriteEnabled: remoteWriterEnabled,
            pendingLocalWrites: 0,
          }
          await resolvedStorage.saveDraft({
            userId,
            document,
            ...(legacyShadow ? { legacyShadow } : {}),
            baseRemoteVersion: null,
            dirty: true,
            mutationId: next.mutationId,
            savedAt: timestamp,
          })
          if (!active || generationRef.current !== generation) return
          publish(next)
        } catch (error) {
          publish({
            ...initialState(userId, remoteWriterEnabled),
            status: { tag: 'fatal', error: toWorkspaceError(error) },
            ready: true,
            readOnly: true,
          })
        }
        return
      }

      if (remote.kind === 'legacy-changed') {
        publishRemoteFailure({
          code: 'REMOTE_CONFLICT',
          message: '旧版云端导航已在其他客户端变化，未自动覆盖本机内容。',
        })
        return
      }
      publishRemoteFailure(remoteFailure(remote), remote.kind === 'retryable')
    }

    void initialize()
    return () => {
      active = false
      clearRetryTimer()
    }
  }, [clearRetryTimer, publish, remoteWriterEnabled, repository, resolvedStorage, userId])

  const enqueueDraft = useCallback(
    (draft: WorkspaceDraft, generation: number) => {
      const task = writeQueueRef.current
        .catch(() => undefined)
        .then(() => resolvedStorage.saveDraft(draft))
      writeQueueRef.current = task
      void task.then(
        () => {
          const current = stateRef.current
          if (generationRef.current !== generation || current.userId !== draft.userId) return
          publish({
            ...current,
            pendingLocalWrites: Math.max(0, current.pendingLocalWrites - 1),
          })
        },
        (error: unknown) => {
          const current = stateRef.current
          if (generationRef.current !== generation || current.userId !== draft.userId) return
          publish({
            ...current,
            status: { tag: 'fatal', error: toWorkspaceError(error) },
            readOnly: true,
            pendingLocalWrites: Math.max(0, current.pendingLocalWrites - 1),
          })
        },
      )
      return task
    },
    [publish, resolvedStorage],
  )

  const persistDocument = useCallback(
    (next: WorkspaceState, savedAt: ISODateTime, dirty: boolean) => {
      if (!next.document) return
      const draft: WorkspaceDraft = {
        userId: next.userId,
        document: next.document,
        ...(next.legacyShadow ? { legacyShadow: next.legacyShadow } : {}),
        baseRemoteVersion: next.baseRemoteVersion,
        dirty,
        mutationId: next.mutationId,
        savedAt,
      }
      enqueueDraft(draft, generationRef.current)
    },
    [enqueueDraft],
  )

  const scheduleRetry = useCallback((attempt: number) => {
    clearRetryTimer()
    const delay = retryDelaysMs[Math.min(attempt - 1, retryDelaysMs.length - 1)] ?? 30_000
    const retryAt = Date.now() + delay
    const current = stateRef.current
    publish({ ...current, status: { tag: 'retryWait', attempt, retryAt } })
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      const latest = stateRef.current
      if (latest.status.tag !== 'retryWait' || latest.status.retryAt !== retryAt || !latest.document) return
      publish({
        ...latest,
        status: { tag: 'dirty', localRevision: latest.document.revision },
      })
    }, delay)
  }, [clearRetryTimer, publish, retryDelaysMs])

  const performRemoteSync = useCallback(async () => {
    const generation = generationRef.current
    const current = stateRef.current
    if (
      !repository ||
      !remoteWriterEnabled ||
      !current.ready ||
      !current.document ||
      current.readOnly ||
      current.pendingLocalWrites > 0 ||
      current.status.tag === 'conflict' ||
      current.status.tag === 'fatal'
    ) return
    if (remoteFlightGenerationRef.current === generation) {
      remoteSyncRequestedRef.current = true
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      publish({ ...current, status: { tag: 'offline', attempt: 1 } })
      return
    }

    if (!current.mutationId) {
      try {
        const timestamp = asCanonicalTime(runtimeRef.current.now())
        const mutationId = asUuid(runtimeRef.current.newId())
        const next: WorkspaceState = {
          ...current,
          mutationId,
          status: { tag: 'dirty', localRevision: current.document.revision },
          pendingLocalWrites: current.pendingLocalWrites + 1,
        }
        publish(next)
        persistDocument(next, timestamp, true)
      } catch {
        publish({
          ...current,
          status: { tag: 'failed', error: { code: 'DATA_INVALID', message: '无法创建同步变更标识。' } },
        })
      }
      return
    }

    clearRetryTimer()
    remoteFlightGenerationRef.current = generation
    remoteSyncRequestedRef.current = false
    const sentDocument = serializeNavConfigV2(current.document)
    const sentRevision = sentDocument.revision
    const sentMutationId = current.mutationId
    const attempt = remoteAttemptRef.current + 1
    remoteAttemptRef.current = attempt
    publish({ ...current, status: { tag: 'syncing', attempt, mutationId: sentMutationId } })

    let result: RemoteSaveResult
    try {
      result = await repository.save({
        userId: current.userId,
        document: sentDocument,
        expectedRemoteVersion: current.baseRemoteVersion,
        mutationId: sentMutationId,
      })
    } catch {
      result = {
        kind: 'retryable',
        error: { code: 'NETWORK', message: '暂时无法连接个人数据服务。', retryable: true },
      }
    }

    try {
      if (generationRef.current !== generation || stateRef.current.userId !== current.userId) return
      const latest = stateRef.current
      if (!latest.document) return
      const sameMutation =
        latest.document.revision === sentRevision && latest.mutationId === sentMutationId

      if (result.kind === 'saved') {
        remoteAttemptRef.current = 0
        const timestamp = asCanonicalTime(runtimeRef.current.now())
        if (sameMutation) {
          const next: WorkspaceState = {
            ...latest,
            document: result.snapshot.document,
            baseRemoteVersion: result.snapshot.remoteVersion,
            mutationId: null,
            status: { tag: 'synced', remoteVersion: result.snapshot.remoteVersion },
            pendingLocalWrites: latest.pendingLocalWrites + 1,
          }
          publish(next)
          persistDocument(next, timestamp, false)
        } else {
          const next: WorkspaceState = {
            ...latest,
            baseRemoteVersion: result.snapshot.remoteVersion,
            status: { tag: 'dirty', localRevision: latest.document.revision },
            pendingLocalWrites: latest.pendingLocalWrites + 1,
          }
          publish(next)
          persistDocument(next, timestamp, true)
          remoteSyncRequestedRef.current = true
        }
        return
      }

      if (result.kind === 'writer-disabled') {
        remoteAttemptRef.current = 0
        publish({
          ...latest,
          status: { tag: 'writerDisabled', localRevision: latest.document.revision },
          remoteWriteEnabled: false,
        })
        return
      }

      if (result.kind === 'conflict') {
        remoteAttemptRef.current = 0
        publish({
          ...latest,
          status: {
            tag: 'conflict',
            local: latest.document,
            remote: result.remote?.document ?? null,
            remoteVersion: result.remote?.remoteVersion ?? null,
            deferred: false,
          },
        })
        return
      }

      if (result.kind === 'retryable') {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          publish({ ...latest, status: { tag: 'offline', attempt } })
        } else {
          scheduleRetry(attempt)
        }
        return
      }

      remoteAttemptRef.current = 0
      publish({ ...latest, status: { tag: 'failed', error: remoteFailure(result) } })
    } finally {
      if (remoteFlightGenerationRef.current === generation) {
        remoteFlightGenerationRef.current = null
        remoteSyncRequestedRef.current = false
      }
    }
  }, [clearRetryTimer, persistDocument, publish, remoteWriterEnabled, repository, scheduleRetry])

  useEffect(() => {
    if (
      state.ready &&
      state.document &&
      state.pendingLocalWrites === 0 &&
      state.status.tag === 'dirty' &&
      repository &&
      remoteWriterEnabled
    ) {
      void performRemoteSync()
    }
  }, [performRemoteSync, remoteWriterEnabled, repository, state.document, state.pendingLocalWrites, state.ready, state.status.tag])

  useEffect(() => {
    if (!repository || typeof window === 'undefined') return
    const handleOnline = () => {
      const current = stateRef.current
      if (!current.document || (current.status.tag !== 'offline' && current.status.tag !== 'retryWait')) return
      clearRetryTimer()
      publish({
        ...current,
        status: unsyncedStatus(current.document, true, remoteWriterEnabled),
      })
    }
    const handleOffline = () => {
      const current = stateRef.current
      if (!current.document || current.status.tag === 'conflict' || current.status.tag === 'fatal') return
      publish({ ...current, status: { tag: 'offline', attempt: 1 } })
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [clearRetryTimer, publish, remoteWriterEnabled, repository])

  const commit = useCallback(
    (mutation: WorkspaceMutation): boolean => {
      const current = stateRef.current
      if (current.userId !== userId || !current.ready || !current.document || current.readOnly) {
        return false
      }
      try {
        const timestamp = asCanonicalTime(runtimeRef.current.now())
        const mutationId = asUuid(runtimeRef.current.newId())
        const workingCopy = serializeNavConfigV2(current.document)
        const proposed = mutation(workingCopy, { now: timestamp })
        const document = normalizeNavConfig({
          ...proposed,
          revision: current.document.revision + 1,
          updatedAt: timestamp,
        })
        const next: WorkspaceState = {
          ...current,
          document,
          mutationId,
          status: unsyncedStatus(document, Boolean(repository), remoteWriterEnabled),
          pendingLocalWrites: current.pendingLocalWrites + 1,
        }
        publish(next)
        persistDocument(next, timestamp, true)
        return true
      } catch {
        publish({
          ...current,
          status: {
            tag: 'failed',
            error: { code: 'DATA_INVALID', message: '这次修改无效，现有数据保持不变。' },
          },
        })
        return false
      }
    },
    [persistDocument, publish, remoteWriterEnabled, repository, userId],
  )

  const toggleFavorite = useCallback(
    (ref: ResourceRefV2) =>
      commit((document, metadata) => {
        const exists = document.favorites.some((favorite) => sameRef(favorite.ref, ref))
        return {
          ...document,
          favorites: exists
            ? document.favorites.filter((favorite) => !sameRef(favorite.ref, ref))
            : [...document.favorites, { ref, createdAt: metadata.now }],
        }
      }),
    [commit],
  )

  const recordRecent = useCallback(
    (ref: ResourceRefV2, openedAt?: ISODateTime) =>
      commit((document, metadata) => ({
        ...document,
        recents: [
          { ref, openedAt: openedAt ?? metadata.now },
          ...document.recents.filter((recent) => !sameRef(recent.ref, ref)),
        ].slice(0, 20),
      })),
    [commit],
  )

  const removeResourceReferences = useCallback(
    (ref: ResourceRefV2) =>
      commit((document) => ({
        ...document,
        favorites: document.favorites.filter((favorite) => !sameRef(favorite.ref, ref)),
        recents: document.recents.filter((recent) => !sameRef(recent.ref, ref)),
      })),
    [commit],
  )

  const retryLocalSave = useCallback((): boolean => {
    const current = stateRef.current
    if (current.userId !== userId || !current.document || current.pendingLocalWrites > 0) {
      return false
    }
    try {
      const timestamp = asCanonicalTime(runtimeRef.current.now())
      const mutationId = current.mutationId ?? asUuid(runtimeRef.current.newId())
      const next: WorkspaceState = {
        ...current,
        mutationId,
        status: unsyncedStatus(current.document, Boolean(repository), remoteWriterEnabled),
        readOnly: false,
        pendingLocalWrites: 1,
      }
      publish(next)
      persistDocument(next, timestamp, true)
      return true
    } catch {
      return false
    }
  }, [persistDocument, publish, remoteWriterEnabled, repository, userId])

  const retrySync = useCallback((): boolean => {
    const current = stateRef.current
    if (
      !repository ||
      !remoteWriterEnabled ||
      !current.document ||
      current.readOnly ||
      current.status.tag === 'conflict' ||
      current.status.tag === 'fatal'
    ) return false
    clearRetryTimer()
    remoteAttemptRef.current = 0
    publish({ ...current, status: { tag: 'dirty', localRevision: current.document.revision } })
    return true
  }, [clearRetryTimer, publish, remoteWriterEnabled, repository])

  const keepLocalVersion = useCallback((): boolean => {
    const current = stateRef.current
    if (current.status.tag !== 'conflict' || !current.document || current.readOnly) return false
    try {
      const timestamp = asCanonicalTime(runtimeRef.current.now())
      const mutationId = asUuid(runtimeRef.current.newId())
      const next: WorkspaceState = {
        ...current,
        baseRemoteVersion: current.status.remoteVersion,
        mutationId,
        status: unsyncedStatus(current.document, Boolean(repository), remoteWriterEnabled),
        pendingLocalWrites: current.pendingLocalWrites + 1,
      }
      publish(next)
      persistDocument(next, timestamp, true)
      return true
    } catch {
      return false
    }
  }, [persistDocument, publish, remoteWriterEnabled, repository])

  const useRemoteVersion = useCallback(async (): Promise<boolean> => {
    const current = stateRef.current
    if (current.status.tag !== 'conflict' || !current.document || current.readOnly) return false
    try {
      const timestamp = asCanonicalTime(runtimeRef.current.now())
      const conflict = current.status
      const backup: WorkspaceConflictBackup = {
        key: `${current.userId}:${timestamp}:${current.document.revision}`,
        userId: current.userId,
        document: current.document,
        remoteVersion: conflict.remoteVersion,
        savedAt: timestamp,
      }
      await resolvedStorage.saveConflictBackup(backup)
      if (stateRef.current.status !== conflict || generationRef.current < 1) return false
      const document = conflict.remote ?? createEmptyDocument(
        timestamp,
        asUuid(runtimeRef.current.newId()),
      )
      const next: WorkspaceState = {
        ...current,
        document,
        baseRemoteVersion: conflict.remoteVersion,
        mutationId: null,
        status: { tag: 'synced', remoteVersion: conflict.remoteVersion },
        pendingLocalWrites: current.pendingLocalWrites + 1,
      }
      publish(next)
      persistDocument(next, timestamp, false)
      return true
    } catch {
      return false
    }
  }, [persistDocument, publish, resolvedStorage])

  const deferConflict = useCallback((): boolean => {
    const current = stateRef.current
    if (current.status.tag !== 'conflict' || current.status.deferred) return false
    publish({ ...current, status: { ...current.status, deferred: true } })
    return true
  }, [publish])

  const reopenConflict = useCallback((): boolean => {
    const current = stateRef.current
    if (current.status.tag !== 'conflict' || !current.status.deferred) return false
    publish({ ...current, status: { ...current.status, deferred: false } })
    return true
  }, [publish])

  const actions = useMemo<WorkspaceActions>(
    () => ({
      commit,
      toggleFavorite,
      recordRecent,
      removeResourceReferences,
      retryLocalSave,
      retrySync,
      keepLocalVersion,
      useRemoteVersion,
      deferConflict,
      reopenConflict,
    }),
    [
      commit,
      deferConflict,
      keepLocalVersion,
      recordRecent,
      removeResourceReferences,
      reopenConflict,
      retryLocalSave,
      retrySync,
      toggleFavorite,
      useRemoteVersion,
    ],
  )

  const exposedState = useMemo<WorkspaceState>(() => {
    if (state.userId === userId) return state
    return {
      ...initialState(userId, remoteWriterEnabled),
      status: { tag: 'loading', cached: false },
    }
  }, [remoteWriterEnabled, state, userId])

  return (
    <WorkspaceStateContext.Provider value={exposedState}>
      <WorkspaceActionsContext.Provider value={actions}>
        {children}
      </WorkspaceActionsContext.Provider>
    </WorkspaceStateContext.Provider>
  )
}

export function useWorkspaceState(): WorkspaceState {
  const value = useContext(WorkspaceStateContext)
  if (!value) throw new Error('useWorkspaceState must be used inside WorkspaceProvider.')
  return value
}

export function useWorkspaceActions(): WorkspaceActions {
  const value = useContext(WorkspaceActionsContext)
  if (!value) throw new Error('useWorkspaceActions must be used inside WorkspaceProvider.')
  return value
}

export function useIsFavorite(ref: ResourceRefV2): boolean {
  const { document } = useWorkspaceState()
  return document?.favorites.some((favorite) => sameRef(favorite.ref, ref)) ?? false
}
