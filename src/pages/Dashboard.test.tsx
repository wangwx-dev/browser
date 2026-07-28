import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceActions, WorkspaceState } from '../contexts/WorkspaceContext'
import type {
  ISODateTime,
  NavConfigV2,
  ResourceRefV2,
  SafeHttpUrl,
  ToolId,
  UUID,
} from '../types/workspace'
import Dashboard from './Dashboard'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  useWorkspaceActions: vi.fn(),
  useWorkspaceState: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

vi.mock('../contexts/useAuth', () => ({ useAuth: mocks.useAuth }))
vi.mock('../contexts/WorkspaceContext', () => ({
  useWorkspaceActions: mocks.useWorkspaceActions,
  useWorkspaceState: mocks.useWorkspaceState,
}))

const NOW = '2026-07-28T04:00:00.000Z' as ISODateTime

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function toolId(value: string): ToolId {
  return value as ToolId
}

function makeSite(value: number, name = `Site ${value}`) {
  return {
    id: uuid(100 + value),
    name,
    url: `https://site-${value}.example.com` as SafeHttpUrl,
    description: `Documentation ${value}`,
    order: value,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function makeDocument(input: Partial<NavConfigV2> = {}): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: uuid(1),
    revision: 1,
    updatedAt: NOW,
    categories: [],
    favorites: [],
    recents: [],
    ...input,
  }
}

function documentWithSites(count = 1): NavConfigV2 {
  return makeDocument({
    categories: [
      {
        id: uuid(2),
        name: '开发资源',
        order: 0,
        createdAt: NOW,
        updatedAt: NOW,
        links: Array.from({ length: count }, (_, index) =>
          makeSite(index, index === 0 ? 'GitHub' : `Site ${index}`),
        ),
      },
    ],
  })
}

function workspaceState(document: NavConfigV2 | null, ready = true): WorkspaceState {
  return {
    userId: 'user-1',
    document,
    baseRemoteVersion: 'remote-v1',
    mutationId: null,
    status: { tag: 'synced', remoteVersion: 'remote-v1' },
    ready,
    readOnly: false,
    remoteWriteEnabled: true,
    pendingLocalWrites: 0,
  }
}

function createActions(): WorkspaceActions {
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
  }
}

function renderDashboard(document: NavConfigV2 | null = makeDocument(), ready = true) {
  mocks.useWorkspaceState.mockReturnValue(workspaceState(document, ready))
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  )
}

function fakePopup(): Window {
  return {
    closed: false,
    close: vi.fn(),
    location: { replace: vi.fn() },
    opener: { source: 'test' },
  } as unknown as Window
}

beforeEach(() => {
  mocks.navigate.mockImplementation(() => undefined)
  mocks.useAuth.mockReturnValue({ user: { email: 'owner@example.com' } })
  mocks.useWorkspaceActions.mockReturnValue(createActions())
})

describe('Dashboard states and resource resolution', () => {
  it('exposes one page heading followed by section and category headings', () => {
    renderDashboard(documentWithSites())

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: '今天想打开什么？' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /收藏/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /最近使用/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /常用工具/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /导航分组/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: /开发资源/ })).toBeInTheDocument()
  })

  it('shows a structural loading state while workspace data is unavailable', () => {
    renderDashboard(null, false)

    expect(screen.getByLabelText('正在载入工作台')).toHaveAttribute('aria-busy', 'true')
    expect(document.querySelectorAll('.dashboard-skeleton').length).toBeGreaterThan(4)
  })

  it('shows distinct empty favorites and recents while keeping six common tools available', () => {
    renderDashboard(makeDocument())

    expect(screen.getByText('把常用网站或工具固定到这里')).toBeInTheDocument()
    expect(screen.getByText('打开过的内容会出现在这里')).toBeInTheDocument()
    const toolsSection = screen.getByRole('heading', { name: /常用工具/ }).closest('section') as HTMLElement
    expect(within(toolsSection).getAllByRole('article')).toHaveLength(6)
    expect(screen.getByRole('button', { name: '搜索网站、工具或命令' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })

  it('deduplicates recent refs, caps them at ten, filters stale refs, and requests one cleanup per stale ref', async () => {
    const document = documentWithSites(12)
    const staleRef: ResourceRefV2 = { kind: 'site', id: uuid(999) }
    document.recents = [
      { ref: { kind: 'site', id: uuid(100) }, openedAt: '2026-07-28T03:00:00.000Z' as ISODateTime },
      { ref: staleRef, openedAt: NOW },
      { ref: { kind: 'site', id: uuid(100) }, openedAt: NOW },
      ...Array.from({ length: 11 }, (_, index) => ({
        ref: { kind: 'site' as const, id: uuid(101 + index) },
        openedAt: `2026-07-28T02:${(59 - index).toString().padStart(2, '0')}:00.000Z` as ISODateTime,
      })),
    ]
    const actions = createActions()
    mocks.useWorkspaceActions.mockReturnValue(actions)
    renderDashboard(document)

    const recentSection = screen.getByRole('heading', { name: /最近使用/ }).closest('section') as HTMLElement
    expect(within(recentSection).getAllByRole('button')).toHaveLength(10)
    expect(within(recentSection).getAllByText('GitHub')).toHaveLength(1)
    expect(within(recentSection).queryByText(/999/)).not.toBeInTheDocument()
    await waitFor(() => expect(actions.removeResourceReferences).toHaveBeenCalledWith(staleRef))
    expect(actions.removeResourceReferences).toHaveBeenCalledOnce()
    expect(await screen.findByText('已清理 1 条失效引用')).toBeInTheDocument()
  })

  it('deduplicates favorites before applying the eight-item cap', () => {
    const document = documentWithSites(10)
    document.favorites = [
      { ref: { kind: 'site', id: uuid(100) }, createdAt: NOW },
      { ref: { kind: 'site', id: uuid(100) }, createdAt: NOW },
      ...Array.from({ length: 8 }, (_, index) => ({
        ref: { kind: 'site' as const, id: uuid(101 + index) },
        createdAt: NOW,
      })),
    ]
    renderDashboard(document)

    const favoritesSection = screen.getByRole('heading', { name: /收藏/ }).closest('section') as HTMLElement
    expect(within(favoritesSection).getAllByRole('article')).toHaveLength(8)
    expect(within(favoritesSection).getAllByText('GitHub')).toHaveLength(1)
  })
})

describe('Dashboard interactions', () => {
  it('toggles tool favorites from both unselected and selected states', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    mocks.useWorkspaceActions.mockReturnValue(actions)
    const document = makeDocument()
    const view = renderDashboard(document)

    await user.click(screen.getByRole('button', { name: '收藏 网络与 IP' }))
    expect(actions.toggleFavorite).toHaveBeenLastCalledWith({ kind: 'tool', id: toolId('network') })

    document.favorites = [
      { ref: { kind: 'tool', id: toolId('network') }, createdAt: NOW },
    ]
    mocks.useWorkspaceState.mockReturnValue(workspaceState(document))
    view.rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    const cancelButtons = screen.getAllByRole('button', { name: '取消收藏 网络与 IP' })
    await user.click(cancelButtons.at(-1) as HTMLElement)
    expect(actions.toggleFavorite).toHaveBeenLastCalledWith({ kind: 'tool', id: toolId('network') })
  })

  it('records a tool only after navigation succeeds', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    let resolveNavigation: (() => void) | undefined
    mocks.navigate.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveNavigation = resolve }),
    )
    mocks.useWorkspaceActions.mockReturnValue(actions)
    renderDashboard(makeDocument())

    const toolsSection = screen.getByRole('heading', { name: /常用工具/ }).closest('section') as HTMLElement
    await user.click(within(toolsSection).getByRole('button', { name: /网络与 IP.*网络工具/ }))
    expect(actions.recordRecent).not.toHaveBeenCalled()
    resolveNavigation?.()

    await waitFor(() => {
      expect(actions.recordRecent).toHaveBeenCalledWith({ kind: 'tool', id: toolId('network') })
    })
  })

  it('records a website only after the popup opens and leaves no opener reference', async () => {
    const user = userEvent.setup()
    const actions = createActions()
    const popup = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    mocks.useWorkspaceActions.mockReturnValue(actions)
    renderDashboard(documentWithSites())

    const navigationSection = screen.getByRole('heading', { name: /导航分组/ }).closest('section') as HTMLElement
    await user.click(within(navigationSection).getByText('GitHub').closest('button') as HTMLElement)

    await waitFor(() => {
      expect(actions.recordRecent).toHaveBeenCalledWith({ kind: 'site', id: uuid(100) })
    })
    expect(popup.opener).toBeNull()
    expect(popup.location.replace).toHaveBeenCalledWith('https://site-0.example.com')
  })
})
