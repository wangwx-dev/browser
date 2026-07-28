import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceActions, WorkspaceState } from '../contexts/WorkspaceContext'
import type { ISODateTime, NavConfigV2, UUID } from '../types/workspace'
import { ConflictDialog } from './ConflictDialog'
import { SyncStatus } from './SyncStatus'

const mocks = vi.hoisted(() => ({
  useWorkspaceActions: vi.fn(),
  useWorkspaceState: vi.fn(),
}))

vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspaceActions: mocks.useWorkspaceActions,
  useWorkspaceState: mocks.useWorkspaceState,
}))

const NOW = '2026-07-28T06:00:00.000Z' as ISODateTime

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function document(name = 'Local'): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: uuid(1),
    revision: 2,
    updatedAt: NOW,
    categories: [{
      id: uuid(2),
      name,
      order: 0,
      links: [],
      createdAt: NOW,
      updatedAt: NOW,
    }],
    favorites: [],
    recents: [],
  }
}

function state(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    userId: uuid(20),
    document: document(),
    baseRemoteVersion: 'remote-v1',
    mutationId: null,
    status: { tag: 'synced', remoteVersion: 'remote-v1' },
    ready: true,
    readOnly: false,
    remoteWriteEnabled: true,
    pendingLocalWrites: 0,
    ...overrides,
  }
}

function actions(overrides: Partial<WorkspaceActions> = {}): WorkspaceActions {
  return {
    commit: vi.fn(() => true),
    toggleFavorite: vi.fn(() => true),
    recordRecent: vi.fn(() => true),
    removeResourceReferences: vi.fn(() => true),
    retryLocalSave: vi.fn(() => true),
    retrySync: vi.fn(() => true),
    keepLocalVersion: vi.fn(() => true),
    useRemoteVersion: vi.fn(async () => true),
    deferConflict: vi.fn(() => true),
    reopenConflict: vi.fn(() => true),
    ...overrides,
  }
}

beforeEach(() => {
  mocks.useWorkspaceState.mockReturnValue(state())
  mocks.useWorkspaceActions.mockReturnValue(actions())
})

describe('SyncStatus', () => {
  it('states explicitly that cloud writes are disabled', () => {
    mocks.useWorkspaceState.mockReturnValue(state({
      remoteWriteEnabled: false,
      status: { tag: 'writerDisabled', localRevision: 2 },
    }))

    render(<SyncStatus />)
    expect(screen.getByText('已保存到本机 · 云端只读')).toBeInTheDocument()
    expect(screen.getByText(/VITE_ENABLE_NAV_V2_WRITE/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
  })

  it('allows an immediate retry and reopens a deferred conflict', async () => {
    const user = userEvent.setup()
    const retrySync = vi.fn(() => true)
    const reopenConflict = vi.fn(() => true)
    mocks.useWorkspaceActions.mockReturnValue(actions({ retrySync, reopenConflict }))
    mocks.useWorkspaceState.mockReturnValue(state({
      status: { tag: 'retryWait', attempt: 2, retryAt: Date.now() + 1000 },
    }))
    const view = render(<SyncStatus />)
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(retrySync).toHaveBeenCalledOnce()

    mocks.useWorkspaceState.mockReturnValue(state({
      status: {
        tag: 'conflict',
        local: document('Local'),
        remote: document('Cloud'),
        remoteVersion: 'remote-v2',
        deferred: true,
      },
    }))
    view.rerender(<SyncStatus />)
    await user.click(screen.getByRole('button', { name: '处理冲突' }))
    expect(reopenConflict).toHaveBeenCalledOnce()
  })
})

describe('ConflictDialog', () => {
  it('stays hidden for normal or explicitly deferred states', () => {
    const view = render(<ConflictDialog />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    mocks.useWorkspaceState.mockReturnValue(state({
      status: {
        tag: 'conflict',
        local: document('Local'),
        remote: null,
        remoteVersion: 'remote-v2',
        deferred: true,
      },
    }))
    view.rerender(<ConflictDialog />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('describes both versions, focuses the safe action, and supports deferring with Escape', async () => {
    const user = userEvent.setup()
    const deferConflict = vi.fn(() => true)
    mocks.useWorkspaceActions.mockReturnValue(actions({ deferConflict }))
    mocks.useWorkspaceState.mockReturnValue(state({
      status: {
        tag: 'conflict',
        local: document('Local'),
        remote: document('Cloud'),
        remoteVersion: 'remote-v2',
        deferred: false,
      },
    }))

    render(<ConflictDialog />)
    const dialog = screen.getByRole('dialog', { name: '选择要保留的工作区版本' })
    expect(screen.getByText('本机版本')).toBeInTheDocument()
    expect(screen.getByText('云端版本')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: '稍后处理' })).toHaveFocus())
    await user.keyboard('{Escape}')
    expect(deferConflict).toHaveBeenCalledOnce()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('does not switch to cloud when the mandatory local backup fails', async () => {
    const user = userEvent.setup()
    const useRemoteVersion = vi.fn(async () => false)
    mocks.useWorkspaceActions.mockReturnValue(actions({ useRemoteVersion }))
    mocks.useWorkspaceState.mockReturnValue(state({
      status: {
        tag: 'conflict',
        local: document('Local'),
        remote: document('Cloud'),
        remoteVersion: 'remote-v2',
        deferred: false,
      },
    }))

    render(<ConflictDialog />)
    await user.click(screen.getByRole('button', { name: '使用云端' }))
    expect(useRemoteVersion).toHaveBeenCalledOnce()
    expect(await screen.findByRole('alert')).toHaveTextContent('无法先备份本机版本')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('reports a failed local submission and permits a later retry', async () => {
    const user = userEvent.setup()
    const keepLocalVersion = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true)
    mocks.useWorkspaceActions.mockReturnValue(actions({ keepLocalVersion }))
    mocks.useWorkspaceState.mockReturnValue(state({
      status: {
        tag: 'conflict',
        local: document('Local'),
        remote: null,
        remoteVersion: 'remote-v2',
        deferred: false,
      },
    }))

    render(<ConflictDialog />)
    const keepLocal = screen.getByRole('button', { name: '保留本机' })
    await user.click(keepLocal)
    expect(screen.getByRole('alert')).toHaveTextContent('无法提交本机版本')
    expect(screen.getByText(/云端当前没有工作区数据/)).toBeInTheDocument()

    await user.click(keepLocal)
    expect(keepLocalVersion).toHaveBeenCalledTimes(2)
  })

  it('accepts a remote version and disables all choices while its backup is pending', async () => {
    let finishBackup!: (accepted: boolean) => void
    const useRemoteVersion = vi.fn(() => new Promise<boolean>((resolve) => { finishBackup = resolve }))
    mocks.useWorkspaceActions.mockReturnValue(actions({ useRemoteVersion }))
    mocks.useWorkspaceState.mockReturnValue(state({
      status: {
        tag: 'conflict',
        local: document('Local'),
        remote: document('Cloud'),
        remoteVersion: 'remote-v2',
        deferred: false,
      },
    }))
    const user = userEvent.setup()

    render(<ConflictDialog />)
    await user.click(screen.getByRole('button', { name: '使用云端' }))

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: /正在备份/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: '稍后处理' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '保留本机' })).toBeDisabled()

    finishBackup(true)
    await waitFor(() => expect(useRemoteVersion).toHaveBeenCalledOnce())
  })
})
