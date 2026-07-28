import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ISODateTime, LegacyShadow, NavConfigV2, UUID } from '../types/workspace'
import {
  createWorkspaceStorage,
  IndexedDbWorkspaceStorage,
  MemoryWorkspaceStorage,
  WorkspaceStorageError,
  type WorkspaceDraft,
} from './workspace-storage'

const NOW = '2026-07-28T00:00:00.000Z' as ISODateTime

afterEach(() => vi.unstubAllGlobals())

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function document(name = 'GitHub'): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: uuid(1),
    revision: 1,
    updatedAt: NOW,
    categories: [
      {
        id: uuid(2),
        name: '常用',
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
        links: [
          {
            id: uuid(3),
            name,
            url: 'https://github.com',
            description: '代码托管',
            order: 0,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    ],
    favorites: [],
    recents: [],
  }
}

function draft(userId: string): WorkspaceDraft {
  return {
    userId,
    document: document(),
    baseRemoteVersion: null,
    dirty: true,
    mutationId: null,
    savedAt: NOW,
  }
}

type StoredRecord = Record<string, unknown>
type FakeEventHandler = (() => void) | null

interface FakeRequestRecord {
  result: unknown
  error: Error
  onsuccess: FakeEventHandler
  onerror: FakeEventHandler
}

interface FakeTransactionRecord {
  error: Error
  oncomplete: FakeEventHandler
  onabort: FakeEventHandler
  onerror: FakeEventHandler
}

class FakeIndexedDb {
  readonly stores = new Map<string, Map<IDBValidKey, unknown>>()
  readonly createdStores: string[] = []
  openFailure: 'error' | 'blocked' | null = null
  operationFailure: 'request' | 'abort' | 'transaction' | null = null
  openCalls = 0

  seed(storeName: string, key: IDBValidKey, value: unknown) {
    this.store(storeName).set(key, structuredClone(value))
  }

  private store(name: string) {
    let store = this.stores.get(name)
    if (!store) {
      store = new Map()
      this.stores.set(name, store)
    }
    return store
  }

  private request<T>(operation: () => T, transaction: FakeTransactionRecord): IDBRequest<T> {
    const request: FakeRequestRecord = {
      result: undefined,
      error: new Error('request failed'),
      onsuccess: null,
      onerror: null,
    }
    queueMicrotask(() => {
      if (this.operationFailure === 'request') {
        request.onerror?.()
        return
      }
      request.result = operation()
      request.onsuccess?.()
      queueMicrotask(() => {
        if (this.operationFailure === 'abort') transaction.onabort?.()
        else if (this.operationFailure === 'transaction') transaction.onerror?.()
        else transaction.oncomplete?.()
      })
    })
    return request as unknown as IDBRequest<T>
  }

  private database(): IDBDatabase {
    const database = {
      objectStoreNames: {
        contains: (name: string) => this.stores.has(name),
      },
      createObjectStore: (name: string) => {
        this.createdStores.push(name)
        this.store(name)
        return {} as IDBObjectStore
      },
      transaction: (name: string) => {
        const transaction: FakeTransactionRecord = {
          error: new Error('transaction failed'),
          oncomplete: null,
          onabort: null,
          onerror: null,
        }
        const objectStore = () => {
            const records = this.store(name)
            return {
              get: (key: IDBValidKey) => {
                return this.request(() => records.get(key), transaction)
              },
              put: (value: StoredRecord) => {
                const key = name === 'conflictBackups' ? value.key : value.userId
                return this.request(() => {
                  records.set(key as IDBValidKey, structuredClone(value))
                  return key as IDBValidKey
                }, transaction)
              },
              delete: (key: IDBValidKey) => {
                return this.request(() => {
                  records.delete(key)
                  return undefined
                }, transaction)
              },
            } as unknown as IDBObjectStore
        }
        Object.assign(transaction, { objectStore })
        return transaction as unknown as IDBTransaction
      },
    }
    return database as unknown as IDBDatabase
  }

  readonly factory = {
    open: () => {
      this.openCalls += 1
      const request: FakeRequestRecord & {
        onupgradeneeded: FakeEventHandler
        onblocked: FakeEventHandler
      } = {
        result: this.database(),
        error: new Error('open failed'),
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      }
      queueMicrotask(() => {
        if (this.openFailure === 'error') request.onerror?.()
        else if (this.openFailure === 'blocked') request.onblocked?.()
        else {
          request.onupgradeneeded?.()
          request.onsuccess?.()
        }
      })
      return request
    },
  } as unknown as IDBFactory
}

describe('MemoryWorkspaceStorage', () => {
  it('scopes drafts by authenticated user ID', async () => {
    const storage = new MemoryWorkspaceStorage([draft('user-a')])

    expect((await storage.loadDraft('user-a'))?.document.categories[0].name).toBe('常用')
    expect(await storage.loadDraft('user-b')).toBeNull()
  })

  it('deep-clones saved and loaded documents', async () => {
    const storage = new MemoryWorkspaceStorage()
    const value = draft('user-a')

    await storage.saveDraft(value)
    value.document.categories[0].name = 'mutated outside'
    const firstLoad = await storage.loadDraft('user-a')
    expect(firstLoad?.document.categories[0].name).toBe('常用')

    firstLoad!.document.categories[0].name = 'mutated loaded copy'
    expect((await storage.loadDraft('user-a'))?.document.categories[0].name).toBe('常用')
  })

  it('persists and clones non-sensitive UI preferences', async () => {
    const storage = new MemoryWorkspaceStorage()
    const preferences = { sidebarCollapsed: true, density: 'compact' }

    await storage.savePreferences('user-a', preferences)
    preferences.sidebarCollapsed = false
    const loaded = await storage.loadPreferences('user-a')

    expect(loaded).toEqual({ sidebarCollapsed: true, density: 'compact' })
  })

  it('stores an isolated conflict backup before a cloud version can replace local data', async () => {
    const storage = new MemoryWorkspaceStorage()
    const local = document('Local only')

    await storage.saveConflictBackup({
      key: 'user-a:backup-1',
      userId: 'user-a',
      document: local,
      remoteVersion: 'remote-v2',
      savedAt: NOW,
    })
    local.categories[0].links[0].name = 'mutated outside'

    expect(storage.conflictBackups[0].document.categories[0].links[0].name).toBe('Local only')
    expect(storage.conflictBackups[0].remoteVersion).toBe('remote-v2')
  })

  it('surfaces write failures without replacing the previous draft', async () => {
    const storage = new MemoryWorkspaceStorage([draft('user-a')])
    storage.failNextSave = new WorkspaceStorageError('LOCAL_STORAGE_FAILED', 'disk full')
    const replacement = { ...draft('user-a'), document: document('Cloudflare') }

    await expect(storage.saveDraft(replacement)).rejects.toThrow('disk full')
    expect((await storage.loadDraft('user-a'))?.document.categories[0].links[0].name).toBe(
      'GitHub',
    )
  })

  it('rejects anonymous or blank storage keys', async () => {
    const storage = new MemoryWorkspaceStorage()

    await expect(storage.loadDraft('  ')).rejects.toMatchObject({ code: 'DATA_INVALID' })
    await expect(storage.savePreferences('', {})).rejects.toMatchObject({ code: 'DATA_INVALID' })
  })

  it('deletes drafts and reports empty preferences without leaking saved history', async () => {
    const storage = new MemoryWorkspaceStorage([draft('user-a')])

    await storage.deleteDraft('user-a')

    expect(await storage.loadDraft('user-a')).toBeNull()
    expect(await storage.loadPreferences('user-a')).toBeNull()
  })

  it('clones legacy shadows when drafts are constructed, saved, and loaded', async () => {
    const value = {
      ...draft('user-a'),
      legacyShadow: {
        sourceFingerprint: 'legacy-fingerprint' as LegacyShadow['sourceFingerprint'],
        document: document('Legacy'),
      },
    }
    const storage = new MemoryWorkspaceStorage([value])

    value.legacyShadow.document.categories[0].name = 'outside mutation'
    const loaded = await storage.loadDraft('user-a')

    expect(loaded?.legacyShadow?.document.categories[0].name).toBe('常用')
  })
})

describe('IndexedDbWorkspaceStorage', () => {
  it('creates all stores once and round-trips drafts, preferences, backups, and deletes', async () => {
    const indexedDb = new FakeIndexedDb()
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)
    const value = draft(' user-a ')

    await storage.saveDraft(value)
    await storage.savePreferences(' user-a ', { sidebarCollapsed: true, density: 'compact' })
    await storage.saveConflictBackup({
      key: 'user-a:backup',
      userId: ' user-a ',
      document: document('Local'),
      remoteVersion: NOW,
      savedAt: NOW,
    })

    expect(indexedDb.createdStores).toEqual(['workspaceDrafts', 'conflictBackups', 'uiPreferences'])
    expect(indexedDb.openCalls).toBe(1)
    expect((await storage.loadDraft('user-a'))?.document).toEqual(document())
    expect(await storage.loadPreferences('user-a')).toEqual({ sidebarCollapsed: true, density: 'compact' })
    expect(indexedDb.stores.get('conflictBackups')?.get('user-a:backup')).toMatchObject({ userId: 'user-a' })

    await storage.deleteDraft(' user-a ')
    expect(await storage.loadDraft('user-a')).toBeNull()
  })

  it('returns null when no preferences were stored', async () => {
    const indexedDb = new FakeIndexedDb()
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)

    expect(await storage.loadPreferences('user-a')).toBeNull()
  })

  it.each([
    [null, 'not an object'],
    [{ userId: 'user-b' }, 'another user'],
    [{ userId: 'user-a', document: { schemaVersion: 2 } }, 'document'],
    [{ userId: 'user-a', document: document(), baseRemoteVersion: 4, dirty: true, mutationId: null, savedAt: NOW }, 'metadata'],
    [{ userId: 'user-a', document: document(), baseRemoteVersion: null, dirty: true, mutationId: null, savedAt: 'yesterday' }, 'timestamp'],
  ])('rejects malformed local drafts (%s)', async (stored, expectedMessage) => {
    const indexedDb = new FakeIndexedDb()
    indexedDb.seed('workspaceDrafts', 'user-a', stored)
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)

    await expect(storage.loadDraft('user-a')).rejects.toMatchObject({
      code: 'DATA_INVALID',
      message: expect.stringContaining(expectedMessage),
    })
  })

  it.each([
    [null, 'shadow'],
    [{ sourceFingerprint: 123, document: document() }, 'fingerprint'],
    [{ sourceFingerprint: 'fingerprint', document: { schemaVersion: 2 } }, 'shadow document'],
  ])('rejects malformed legacy shadows (%s)', async (legacyShadow, expectedMessage) => {
    const indexedDb = new FakeIndexedDb()
    indexedDb.seed('workspaceDrafts', 'user-a', { ...draft('user-a'), legacyShadow })
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)

    await expect(storage.loadDraft('user-a')).rejects.toMatchObject({
      code: 'DATA_INVALID',
      message: expect.stringContaining(expectedMessage),
    })
  })

  it.each([
    [{ userId: 'user-b', preferences: {} }, 'preferences'],
    [{ userId: 'user-a', preferences: null }, 'preferences'],
  ])('rejects malformed preference records (%s)', async (record, expectedMessage) => {
    const indexedDb = new FakeIndexedDb()
    indexedDb.seed('uiPreferences', 'user-a', record)
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)

    await expect(storage.loadPreferences('user-a')).rejects.toMatchObject({
      code: 'DATA_INVALID',
      message: expect.stringContaining(expectedMessage),
    })
  })

  it.each([
    ['error', 'Could not open'],
    ['blocked', 'blocked'],
  ] as const)('maps IndexedDB open %s failures and retries a later open', async (failure, message) => {
    const indexedDb = new FakeIndexedDb()
    indexedDb.openFailure = failure
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)

    await expect(storage.loadDraft('user-a')).rejects.toMatchObject({
      code: 'LOCAL_STORAGE_FAILED',
      message: expect.stringContaining(message),
    })
    indexedDb.openFailure = null
    expect(await storage.loadDraft('user-a')).toBeNull()
    expect(indexedDb.openCalls).toBe(2)
  })

  it.each([
    ['request', 'request failed'],
    ['abort', 'aborted'],
    ['transaction', 'transaction failed'],
  ] as const)('maps IndexedDB %s failures to stable storage errors', async (failure, message) => {
    const indexedDb = new FakeIndexedDb()
    indexedDb.operationFailure = failure
    const storage = new IndexedDbWorkspaceStorage(indexedDb.factory)

    await expect(storage.loadDraft('user-a')).rejects.toMatchObject({
      code: 'LOCAL_STORAGE_FAILED',
      message: expect.stringContaining(message),
    })
  })
})

describe('createWorkspaceStorage', () => {
  it('fails explicitly when IndexedDB is unavailable', () => {
    vi.stubGlobal('indexedDB', undefined)

    expect(() => createWorkspaceStorage()).toThrowError(WorkspaceStorageError)
  })

  it('binds the browser IndexedDB factory when available', () => {
    const indexedDb = new FakeIndexedDb()
    vi.stubGlobal('indexedDB', indexedDb.factory)

    expect(createWorkspaceStorage()).toBeInstanceOf(IndexedDbWorkspaceStorage)
  })
})
