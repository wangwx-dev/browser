import { StrictMode } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MemoryWorkspaceStorage, type WorkspaceDraft } from '../services/workspace-storage'
import type { WorkspaceRepository } from '../services/workspace-repository'
import type { ISODateTime, NavConfigV2, ResourceRefV2, UUID } from '../types/workspace'
import {
  WorkspaceProvider,
  useWorkspaceActions,
  useWorkspaceState,
} from './WorkspaceContext'

const NOW = '2026-07-28T00:00:00.000Z' as ISODateTime

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function initialDocument(label = 'GitHub'): NavConfigV2 {
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
            name: label,
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

function draft(userId: string, label = 'GitHub'): WorkspaceDraft {
  return {
    userId,
    document: initialDocument(label),
    baseRemoteVersion: 'remote-v1',
    dirty: false,
    mutationId: null,
    savedAt: NOW,
  }
}

function sequentialIds(start = 1000): () => string {
  let next = start
  return () => uuid(next++)
}

function Harness() {
  const state = useWorkspaceState()
  const actions = useWorkspaceActions()
  const siteRef: ResourceRefV2 = { kind: 'site', id: uuid(3) }

  return (
    <div>
      <output data-testid="user-id">{state.userId}</output>
      <output data-testid="ready">{String(state.ready)}</output>
      <output data-testid="status">{state.status.tag}</output>
      <output data-testid="read-only">{String(state.readOnly)}</output>
      <output data-testid="remote-write-enabled">{String(state.remoteWriteEnabled)}</output>
      <output data-testid="base-version">{state.baseRemoteVersion ?? ''}</output>
      <output data-testid="pending">{state.pendingLocalWrites}</output>
      <output data-testid="revision">{state.document?.revision ?? 0}</output>
      <output data-testid="favorite-count">{state.document?.favorites.length ?? 0}</output>
      <output data-testid="recent-count">{state.document?.recents.length ?? 0}</output>
      <output data-testid="first-recent">{state.document?.recents[0]?.ref.id ?? ''}</output>
      <output data-testid="category-count">{state.document?.categories.length ?? 0}</output>
      <output data-testid="first-link">{state.document?.categories[0]?.links[0]?.name ?? ''}</output>
      <button type="button" onClick={() => actions.toggleFavorite(siteRef)}>
        toggle favorite
      </button>
      <button type="button" onClick={() => actions.recordRecent(siteRef)}>
        recent
      </button>
      <button
        type="button"
        onClick={() => {
          for (let index = 0; index < 21; index += 1) {
            actions.recordRecent({ kind: 'site', id: uuid(100 + index) })
          }
        }}
      >
        many recents
      </button>
      <button type="button" onClick={actions.retryLocalSave}>
        retry local save
      </button>
      <button type="button" onClick={actions.retrySync}>
        retry sync
      </button>
      <button type="button" onClick={actions.keepLocalVersion}>
        keep local
      </button>
      <button type="button" onClick={() => { void actions.useRemoteVersion() }}>
        use remote
      </button>
      <button type="button" onClick={actions.deferConflict}>
        defer conflict
      </button>
      <button type="button" onClick={actions.reopenConflict}>
        reopen conflict
      </button>
    </div>
  )
}

async function waitUntilReady() {
  await waitFor(() => expect(screen.getByTestId('ready')).toHaveTextContent('true'))
}

describe('WorkspaceProvider', () => {
  it('loads only the authenticated user draft before exposing workspace data', async () => {
    const storage = new MemoryWorkspaceStorage([draft('user-a', 'Private A')])

    render(
      <WorkspaceProvider
        userId="user-a"
        storage={storage}
        initialDocument={initialDocument('Fallback')}
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Harness />
      </WorkspaceProvider>,
    )

    expect(screen.getByTestId('ready')).toHaveTextContent('false')
    await waitUntilReady()
    expect(screen.getByTestId('first-link')).toHaveTextContent('Private A')
    expect(screen.getByTestId('status')).toHaveTextContent('synced')
  })

  it('persists a fresh initial document locally before marking it ready', async () => {
    const storage = new MemoryWorkspaceStorage()

    render(
      <StrictMode>
        <WorkspaceProvider
          userId="user-a"
          storage={storage}
          initialDocument={initialDocument()}
          now={() => NOW}
          newId={sequentialIds()}
        >
          <Harness />
        </WorkspaceProvider>
      </StrictMode>,
    )

    await waitUntilReady()
    expect(storage.savedDrafts).toHaveLength(1)
    expect(storage.savedDrafts[0].dirty).toBe(true)
    expect(screen.getByTestId('status')).toHaveTextContent('dirty')
  })

  it('applies favorite changes immediately and then saves the exact revision', async () => {
    const storage = new MemoryWorkspaceStorage()
    const user = userEvent.setup()

    render(
      <WorkspaceProvider
        userId="user-a"
        storage={storage}
        initialDocument={initialDocument()}
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()

    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))
    expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
    expect(screen.getByTestId('revision')).toHaveTextContent('2')
    expect(screen.getByTestId('status')).toHaveTextContent('dirty')

    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('0'))
    expect(storage.savedDrafts.at(-1)?.document.favorites).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))
    expect(screen.getByTestId('favorite-count')).toHaveTextContent('0')
  })

  it('deduplicates recents, keeps only 20 and writes every local mutation serially', async () => {
    class SlowStorage extends MemoryWorkspaceStorage {
      inFlight = 0
      maxInFlight = 0

      override async saveDraft(value: WorkspaceDraft): Promise<void> {
        this.inFlight += 1
        this.maxInFlight = Math.max(this.maxInFlight, this.inFlight)
        await new Promise((resolve) => setTimeout(resolve, 1))
        await super.saveDraft(value)
        this.inFlight -= 1
      }
    }

    const storage = new SlowStorage()
    const user = userEvent.setup()
    render(
      <WorkspaceProvider
        userId="user-a"
        storage={storage}
        initialDocument={initialDocument()}
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()

    await user.click(screen.getByRole('button', { name: 'many recents' }))
    expect(screen.getByTestId('recent-count')).toHaveTextContent('20')
    expect(screen.getByTestId('first-recent')).toHaveTextContent(uuid(120))
    expect(Number(screen.getByTestId('pending').textContent)).toBeGreaterThan(0)
    await waitFor(() => expect(storage.savedDrafts).toHaveLength(22))
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('0'))

    expect(storage.maxInFlight).toBe(1)
    expect(storage.savedDrafts.slice(1).map((value) => value.document.revision)).toEqual(
      Array.from({ length: 21 }, (_, index) => index + 2),
    )
  })

  it('never rolls back the latest in-memory document when local persistence fails', async () => {
    const storage = new MemoryWorkspaceStorage()
    const user = userEvent.setup()
    render(
      <WorkspaceProvider
        userId="user-a"
        storage={storage}
        initialDocument={initialDocument()}
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()
    storage.failNextSave = new Error('quota exceeded')

    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))
    expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('fatal'))
    expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
    expect(screen.getByTestId('read-only')).toHaveTextContent('true')

    await user.click(screen.getByRole('button', { name: 'retry local save' }))
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('0'))
    expect(storage.savedDrafts.at(-1)?.document.favorites).toHaveLength(1)
    expect(screen.getByTestId('read-only')).toHaveTextContent('false')
  })

  it('clears the visible document before loading a different user and never reuses fallback data', async () => {
    const storage = new MemoryWorkspaceStorage([draft('user-a', 'Private A')])
    const ids = sequentialIds(5000)
    const view = render(
      <WorkspaceProvider
        userId="user-a"
        storage={storage}
        initialDocument={initialDocument('Fallback A')}
        now={() => NOW}
        newId={ids}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()
    expect(screen.getByTestId('first-link')).toHaveTextContent('Private A')

    await act(async () => {
      view.rerender(
        <WorkspaceProvider
          userId="user-b"
          storage={storage}
          initialDocument={initialDocument('Fallback A')}
          now={() => NOW}
          newId={ids}
        >
          <Harness />
        </WorkspaceProvider>,
      )
    })

    await waitUntilReady()
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-b')
    expect(screen.getByTestId('category-count')).toHaveTextContent('0')
    expect((await storage.loadDraft('user-a'))?.document.categories[0].links[0].name).toBe(
      'Private A',
    )
  })

  it('loads from the repository but keeps every mutation local when the v2 writer flag is disabled', async () => {
    const storage = new MemoryWorkspaceStorage()
    const save = vi.fn<WorkspaceRepository['save']>()
    const repository: WorkspaceRepository = {
      load: vi.fn(async () => ({
        kind: 'loaded' as const,
        source: 'v2' as const,
        snapshot: { document: initialDocument('Cloud'), remoteVersion: 'remote-v1' },
        warnings: [],
      })),
      save,
    }
    const user = userEvent.setup()

    render(
      <WorkspaceProvider
        userId={uuid(900)}
        storage={storage}
        repository={repository}
        remoteWriterEnabled={false}
        initialDocument={initialDocument('Fallback')}
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()
    expect(screen.getByTestId('first-link')).toHaveTextContent('Cloud')
    expect(screen.getByTestId('remote-write-enabled')).toHaveTextContent('false')

    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))
    expect(screen.getByTestId('status')).toHaveTextContent('writerDisabled')
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('0'))
    expect(save).not.toHaveBeenCalled()
    expect(storage.savedDrafts.at(-1)?.dirty).toBe(true)
  })

  it('saves a dirty cached draft with CAS and marks the exact revision clean', async () => {
    const cached = { ...draft(uuid(901), 'Local'), dirty: true, mutationId: uuid(700) }
    const storage = new MemoryWorkspaceStorage([cached])
    const save = vi.fn<WorkspaceRepository['save']>(async (input) => ({
      kind: 'saved',
      snapshot: { document: input.document, remoteVersion: 'remote-v2' },
    }))
    const repository: WorkspaceRepository = {
      load: vi.fn(async () => ({
        kind: 'loaded' as const,
        source: 'v2' as const,
        snapshot: { document: initialDocument('Cloud base'), remoteVersion: 'remote-v1' },
        warnings: [],
      })),
      save,
    }

    render(
      <WorkspaceProvider
        userId={uuid(901)}
        storage={storage}
        repository={repository}
        remoteWriterEnabled
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Harness />
      </WorkspaceProvider>,
    )

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toMatchObject({
      expectedRemoteVersion: 'remote-v1',
      mutationId: uuid(700),
    })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('synced'))
    expect(screen.getByTestId('first-link')).toHaveTextContent('Local')
    expect(screen.getByTestId('base-version')).toHaveTextContent('remote-v2')
    expect(storage.savedDrafts.at(-1)?.dirty).toBe(false)
  })

  it('never lets an older save response overwrite a newer local revision', async () => {
    let resolveFirst!: (result: Awaited<ReturnType<WorkspaceRepository['save']>>) => void
    const firstSave = new Promise<Awaited<ReturnType<WorkspaceRepository['save']>>>((resolve) => {
      resolveFirst = resolve
    })
    const save = vi.fn<WorkspaceRepository['save']>((input) => {
      if (save.mock.calls.length === 1) return firstSave
      return Promise.resolve({
        kind: 'saved',
        snapshot: { document: input.document, remoteVersion: 'remote-v3' },
      })
    })
    const repository: WorkspaceRepository = {
      load: vi.fn(async () => ({
        kind: 'loaded' as const,
        source: 'v2' as const,
        snapshot: { document: initialDocument(), remoteVersion: 'remote-v1' },
        warnings: [],
      })),
      save,
    }
    const storage = new MemoryWorkspaceStorage()
    const user = userEvent.setup()

    render(
      <WorkspaceProvider
        userId={uuid(902)}
        storage={storage}
        repository={repository}
        remoteWriterEnabled
        now={() => NOW}
        newId={sequentialIds(800)}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()
    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'recent' }))
    expect(screen.getByTestId('revision')).toHaveTextContent('3')

    await act(async () => {
      resolveFirst({
        kind: 'saved',
        snapshot: { document: save.mock.calls[0][0].document, remoteVersion: 'remote-v2' },
      })
      await firstSave
    })

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(save.mock.calls[1][0].expectedRemoteVersion).toBe('remote-v2')
    expect(save.mock.calls[1][0].document.revision).toBe(3)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('synced'))
    expect(screen.getByTestId('revision')).toHaveTextContent('3')
    expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
    expect(screen.getByTestId('recent-count')).toHaveTextContent('1')
  })

  it('backs up the local conflict document before accepting the cloud version', async () => {
    const storage = new MemoryWorkspaceStorage()
    const remoteConflict = initialDocument('Cloud winner')
    const save = vi.fn<WorkspaceRepository['save']>(async () => ({
      kind: 'conflict',
      remote: { document: remoteConflict, remoteVersion: 'remote-v2' },
    }))
    const repository: WorkspaceRepository = {
      load: vi.fn(async () => ({
        kind: 'loaded' as const,
        source: 'v2' as const,
        snapshot: { document: initialDocument('Base'), remoteVersion: 'remote-v1' },
        warnings: [],
      })),
      save,
    }
    const user = userEvent.setup()

    render(
      <WorkspaceProvider
        userId={uuid(903)}
        storage={storage}
        repository={repository}
        remoteWriterEnabled
        now={() => NOW}
        newId={sequentialIds(900)}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()
    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('conflict'))

    await user.click(screen.getByRole('button', { name: 'use remote' }))
    await waitFor(() => expect(screen.getByTestId('first-link')).toHaveTextContent('Cloud winner'))
    expect(storage.conflictBackups).toHaveLength(1)
    expect(storage.conflictBackups[0].document.favorites).toHaveLength(1)
    expect(storage.savedDrafts.at(-1)?.dirty).toBe(false)
    expect(screen.getByTestId('base-version')).toHaveTextContent('remote-v2')
  })

  it('retries transient remote failures with increasing attempts without rolling back local data', async () => {
    const save = vi.fn<WorkspaceRepository['save']>()
      .mockResolvedValueOnce({
        kind: 'retryable',
        error: { code: 'NETWORK', message: 'offline', retryable: true },
      })
      .mockImplementationOnce(async (input) => ({
        kind: 'saved',
        snapshot: { document: input.document, remoteVersion: 'remote-v2' },
      }))
    const repository: WorkspaceRepository = {
      load: vi.fn(async () => ({
        kind: 'loaded' as const,
        source: 'v2' as const,
        snapshot: { document: initialDocument(), remoteVersion: 'remote-v1' },
        warnings: [],
      })),
      save,
    }
    const user = userEvent.setup()

    render(
      <WorkspaceProvider
        userId={uuid(904)}
        storage={new MemoryWorkspaceStorage()}
        repository={repository}
        remoteWriterEnabled
        retryDelaysMs={[1, 2]}
        now={() => NOW}
        newId={sequentialIds(950)}
      >
        <Harness />
      </WorkspaceProvider>,
    )
    await waitUntilReady()
    await user.click(screen.getByRole('button', { name: 'toggle favorite' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('synced'))
    expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
  })
})
