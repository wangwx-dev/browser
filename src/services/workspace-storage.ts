import { parseRemoteDocument, serializeNavConfigV2 } from '../domain/nav-config'
import type {
  ISODateTime,
  JsonValue,
  LegacyShadow,
  NavConfigV2,
  UUID,
} from '../types/workspace'

export const WORKSPACE_DATABASE_NAME = 'dev-workbench'
export const WORKSPACE_DATABASE_VERSION = 1

const DRAFT_STORE = 'workspaceDrafts'
const CONFLICT_STORE = 'conflictBackups'
const PREFERENCES_STORE = 'uiPreferences'

export interface WorkspaceDraft {
  userId: string
  document: NavConfigV2
  legacyShadow?: LegacyShadow
  baseRemoteVersion: string | null
  dirty: boolean
  mutationId: UUID | null
  savedAt: ISODateTime
}

export interface WorkspaceConflictBackup {
  key: string
  userId: string
  document: NavConfigV2
  remoteVersion: string | null
  savedAt: ISODateTime
}

export interface WorkspaceUiPreferences {
  sidebarCollapsed?: boolean
  [key: string]: JsonValue | undefined
}

export interface WorkspaceStorage {
  loadDraft(userId: string): Promise<WorkspaceDraft | null>
  saveDraft(draft: WorkspaceDraft): Promise<void>
  deleteDraft(userId: string): Promise<void>
  loadPreferences(userId: string): Promise<WorkspaceUiPreferences | null>
  savePreferences(userId: string, preferences: WorkspaceUiPreferences): Promise<void>
  saveConflictBackup(backup: WorkspaceConflictBackup): Promise<void>
}

export class WorkspaceStorageError extends Error {
  readonly code: 'LOCAL_STORAGE_FAILED' | 'DATA_INVALID'

  constructor(code: WorkspaceStorageError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'WorkspaceStorageError'
    this.code = code
  }
}

function assertUserId(userId: string): string {
  const normalized = userId.trim()
  if (normalized.length === 0) {
    throw new WorkspaceStorageError('DATA_INVALID', 'A non-empty authenticated user ID is required.')
  }
  return normalized
}

function cloneLegacyShadow(shadow: LegacyShadow | undefined): LegacyShadow | undefined {
  if (!shadow) return undefined
  return {
    sourceFingerprint: shadow.sourceFingerprint,
    document: serializeNavConfigV2(shadow.document),
  }
}

function cloneDraft(draft: WorkspaceDraft): WorkspaceDraft {
  return {
    ...draft,
    document: serializeNavConfigV2(draft.document),
    ...(draft.legacyShadow ? { legacyShadow: cloneLegacyShadow(draft.legacyShadow) } : {}),
  }
}

function cloneConflictBackup(backup: WorkspaceConflictBackup): WorkspaceConflictBackup {
  return {
    ...backup,
    document: serializeNavConfigV2(backup.document),
  }
}

function clonePreferences(preferences: WorkspaceUiPreferences): WorkspaceUiPreferences {
  return structuredClone(preferences)
}

function parseStoredLegacyShadow(value: unknown): LegacyShadow | undefined {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local legacy shadow is invalid.')
  }
  const record = value as Record<string, unknown>
  if (typeof record.sourceFingerprint !== 'string') {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local legacy fingerprint is invalid.')
  }
  const parsed = parseRemoteDocument(record.document)
  if (parsed.kind !== 'valid-v2') {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local legacy shadow document is invalid.')
  }
  return {
    sourceFingerprint: record.sourceFingerprint as LegacyShadow['sourceFingerprint'],
    document: parsed.document,
  }
}

function parseStoredDraft(value: unknown, expectedUserId: string): WorkspaceDraft {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local workspace draft is not an object.')
  }
  const record = value as Record<string, unknown>
  if (record.userId !== expectedUserId) {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local workspace draft belongs to another user.')
  }
  const parsed = parseRemoteDocument(record.document)
  if (parsed.kind !== 'valid-v2') {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local workspace document is invalid.')
  }
  if (
    (record.baseRemoteVersion !== null && typeof record.baseRemoteVersion !== 'string') ||
    typeof record.dirty !== 'boolean' ||
    (record.mutationId !== null && typeof record.mutationId !== 'string') ||
    typeof record.savedAt !== 'string'
  ) {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local workspace draft metadata is invalid.')
  }
  const savedAt = Date.parse(record.savedAt)
  if (!Number.isFinite(savedAt) || new Date(savedAt).toISOString() !== record.savedAt) {
    throw new WorkspaceStorageError('DATA_INVALID', 'The local workspace draft timestamp is invalid.')
  }

  return cloneDraft({
    userId: expectedUserId,
    document: parsed.document,
    ...(record.legacyShadow === undefined
      ? {}
      : { legacyShadow: parseStoredLegacyShadow(record.legacyShadow) }),
    baseRemoteVersion: record.baseRemoteVersion as string | null,
    dirty: record.dirty,
    mutationId: record.mutationId as UUID | null,
    savedAt: record.savedAt as ISODateTime,
  })
}

interface PreferenceRecord {
  userId: string
  preferences: WorkspaceUiPreferences
}

export class IndexedDbWorkspaceStorage implements WorkspaceStorage {
  private readonly factory: IDBFactory
  private databasePromise: Promise<IDBDatabase> | null = null

  constructor(factory: IDBFactory = indexedDB) {
    this.factory = factory
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise
    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(WORKSPACE_DATABASE_NAME, WORKSPACE_DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(DRAFT_STORE)) {
          database.createObjectStore(DRAFT_STORE, { keyPath: 'userId' })
        }
        if (!database.objectStoreNames.contains(CONFLICT_STORE)) {
          database.createObjectStore(CONFLICT_STORE, { keyPath: 'key' })
        }
        if (!database.objectStoreNames.contains(PREFERENCES_STORE)) {
          database.createObjectStore(PREFERENCES_STORE, { keyPath: 'userId' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        this.databasePromise = null
        reject(
          new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'Could not open local workspace storage.', {
            cause: request.error,
          }),
        )
      }
      request.onblocked = () => {
        this.databasePromise = null
        reject(new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'Local workspace storage upgrade is blocked.'))
      }
    })
    return this.databasePromise
  }

  private async request<T>(
    storeName: string,
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await this.openDatabase()
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode)
      const request = operation(transaction.objectStore(storeName))
      let result: T
      let requestSucceeded = false

      request.onsuccess = () => {
        result = request.result
        requestSucceeded = true
      }
      request.onerror = () => {
        reject(
          new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'A local workspace storage request failed.', {
            cause: request.error,
          }),
        )
      }
      transaction.oncomplete = () => {
        if (requestSucceeded) resolve(result)
      }
      transaction.onabort = () => {
        reject(
          new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'A local workspace storage transaction was aborted.', {
            cause: transaction.error,
          }),
        )
      }
      transaction.onerror = () => {
        reject(
          new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'A local workspace storage transaction failed.', {
            cause: transaction.error,
          }),
        )
      }
    })
  }

  async loadDraft(userId: string): Promise<WorkspaceDraft | null> {
    const normalizedUserId = assertUserId(userId)
    const stored = await this.request<unknown>(DRAFT_STORE, 'readonly', (store) => store.get(normalizedUserId))
    return stored === undefined ? null : parseStoredDraft(stored, normalizedUserId)
  }

  async saveDraft(draft: WorkspaceDraft): Promise<void> {
    const normalizedUserId = assertUserId(draft.userId)
    const safeDraft = cloneDraft({ ...draft, userId: normalizedUserId })
    await this.request<IDBValidKey>(DRAFT_STORE, 'readwrite', (store) => store.put(safeDraft))
  }

  async deleteDraft(userId: string): Promise<void> {
    await this.request<undefined>(DRAFT_STORE, 'readwrite', (store) => store.delete(assertUserId(userId)))
  }

  async loadPreferences(userId: string): Promise<WorkspaceUiPreferences | null> {
    const normalizedUserId = assertUserId(userId)
    const stored = await this.request<PreferenceRecord | undefined>(PREFERENCES_STORE, 'readonly', (store) =>
      store.get(normalizedUserId),
    )
    if (!stored) return null
    if (stored.userId !== normalizedUserId || stored.preferences === null || typeof stored.preferences !== 'object') {
      throw new WorkspaceStorageError('DATA_INVALID', 'The local workspace preferences are invalid.')
    }
    return clonePreferences(stored.preferences)
  }

  async savePreferences(userId: string, preferences: WorkspaceUiPreferences): Promise<void> {
    const normalizedUserId = assertUserId(userId)
    const record: PreferenceRecord = {
      userId: normalizedUserId,
      preferences: clonePreferences(preferences),
    }
    await this.request<IDBValidKey>(PREFERENCES_STORE, 'readwrite', (store) => store.put(record))
  }

  async saveConflictBackup(backup: WorkspaceConflictBackup): Promise<void> {
    const normalizedUserId = assertUserId(backup.userId)
    const safeBackup = cloneConflictBackup({ ...backup, userId: normalizedUserId })
    await this.request<IDBValidKey>(CONFLICT_STORE, 'readwrite', (store) => store.put(safeBackup))
  }
}

export class MemoryWorkspaceStorage implements WorkspaceStorage {
  private readonly drafts = new Map<string, WorkspaceDraft>()
  private readonly preferences = new Map<string, WorkspaceUiPreferences>()
  readonly savedDrafts: WorkspaceDraft[] = []
  readonly conflictBackups: WorkspaceConflictBackup[] = []
  failNextSave: Error | null = null

  constructor(initialDrafts: readonly WorkspaceDraft[] = []) {
    initialDrafts.forEach((draft) => this.drafts.set(assertUserId(draft.userId), cloneDraft(draft)))
  }

  async loadDraft(userId: string): Promise<WorkspaceDraft | null> {
    const draft = this.drafts.get(assertUserId(userId))
    return draft ? cloneDraft(draft) : null
  }

  async saveDraft(draft: WorkspaceDraft): Promise<void> {
    if (this.failNextSave) {
      const error = this.failNextSave
      this.failNextSave = null
      throw error
    }
    const cloned = cloneDraft({ ...draft, userId: assertUserId(draft.userId) })
    this.drafts.set(cloned.userId, cloned)
    this.savedDrafts.push(cloneDraft(cloned))
  }

  async deleteDraft(userId: string): Promise<void> {
    this.drafts.delete(assertUserId(userId))
  }

  async loadPreferences(userId: string): Promise<WorkspaceUiPreferences | null> {
    const value = this.preferences.get(assertUserId(userId))
    return value ? clonePreferences(value) : null
  }

  async savePreferences(userId: string, preferences: WorkspaceUiPreferences): Promise<void> {
    this.preferences.set(assertUserId(userId), clonePreferences(preferences))
  }

  async saveConflictBackup(backup: WorkspaceConflictBackup): Promise<void> {
    const safeBackup = cloneConflictBackup({ ...backup, userId: assertUserId(backup.userId) })
    this.conflictBackups.push(safeBackup)
  }
}

export function createWorkspaceStorage(): WorkspaceStorage {
  if (typeof indexedDB === 'undefined') {
    throw new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'IndexedDB is unavailable in this browser.')
  }
  return new IndexedDbWorkspaceStorage(indexedDB)
}
