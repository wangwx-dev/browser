import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  WorkspaceActions,
  WorkspaceState,
} from '../contexts/WorkspaceContext'
import { openCommandPalette } from '../domain/command-palette'
import { openExternalSite } from '../domain/command-execution'
import type {
  ISODateTime,
  NavConfigV2,
  ResourceRefV2,
  SafeHttpUrl,
  ToolId,
  UUID,
} from '../types/workspace'
import { CommandPalette } from './CommandPalette'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useWorkspaceActions: vi.fn(),
  useWorkspaceState: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

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

function siteLink(value: number, name = `Site ${value}`) {
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
          siteLink(index, index === 0 ? 'Example Docs' : `Site ${index}`),
        ),
      },
    ],
  })
}

function workspaceState(document: NavConfigV2): WorkspaceState {
  return {
    userId: 'user-1',
    document,
    baseRemoteVersion: 'remote-v1',
    mutationId: null,
    status: { tag: 'synced', remoteVersion: 'remote-v1' },
    ready: true,
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

function renderPalette(document = makeDocument()) {
  render(
    <MemoryRouter>
      <button type="button">原触发按钮</button>
      <CommandPalette />
    </MemoryRouter>,
  )
  return { trigger: screen.getByRole('button', { name: '原触发按钮' }), document }
}

async function openFromTrigger(trigger: HTMLElement) {
  const user = userEvent.setup()
  await user.click(trigger)
  await user.keyboard('{Control>}k{/Control}')
  const input = await screen.findByRole('combobox')
  await waitFor(() => expect(input).toHaveFocus())
  return { input, user }
}

function selectedOption(): HTMLElement | undefined {
  return screen
    .queryAllByRole('option')
    .find((option) => option.getAttribute('aria-selected') === 'true')
}

function fakePopup(replace = vi.fn()): Window {
  return {
    closed: false,
    close: vi.fn(),
    location: { replace },
    opener: { source: 'test' },
  } as unknown as Window
}

let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView

beforeEach(() => {
  originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
    writable: true,
  })
  mocks.navigate.mockImplementation(() => undefined)
  mocks.useWorkspaceState.mockReturnValue(workspaceState(makeDocument()))
  mocks.useWorkspaceActions.mockReturnValue(createActions())
})

afterEach(() => {
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: originalScrollIntoView,
      writable: true,
    })
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
  }
})

describe('CommandPalette global shortcut and focus lifecycle', () => {
  it('opens and closes globally, then restores focus to the original trigger', async () => {
    const { trigger } = renderPalette()
    const { input, user } = await openFromTrigger(trigger)

    expect(screen.getByRole('dialog', { name: '命令面板' })).toBeInTheDocument()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(input).not.toBeInTheDocument()
  })

  it('does not hijack Ctrl/Cmd+K from editable or inherited contenteditable targets', () => {
    render(
      <MemoryRouter>
        <input aria-label="普通输入" />
        <textarea aria-label="多行输入" />
        <select aria-label="选择器"><option>One</option></select>
        <div ref={(node) => { node?.setAttribute('contenteditable', '') }} tabIndex={0}>空值 editable</div>
        <div contentEditable="plaintext-only" suppressContentEditableWarning tabIndex={0}>纯文本 editable</div>
        <div contentEditable="true" suppressContentEditableWarning><button type="button">继承 editable</button></div>
        <CommandPalette />
      </MemoryRouter>,
    )

    const targets = [
      screen.getByRole('textbox', { name: '普通输入' }),
      screen.getByRole('textbox', { name: '多行输入' }),
      screen.getByRole('combobox', { name: '选择器' }),
      screen.getByText('空值 editable'),
      screen.getByText('纯文本 editable'),
      screen.getByRole('button', { name: '继承 editable' }),
    ]

    targets.forEach((target, index) => {
      target.focus()
      fireEvent.keyDown(document, {
        key: 'k',
        ...(index % 2 === 0 ? { ctrlKey: true } : { metaKey: true }),
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('re-focuses the existing query on a repeated shortcut without replacing return focus', async () => {
    const { trigger } = renderPalette()
    const { input, user } = await openFromTrigger(trigger)
    const closeButton = screen.getByRole('button', { name: '关闭命令面板' })
    closeButton.focus()
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    await waitFor(() => expect(input).toHaveFocus())
    await user.keyboard('{Escape}')

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('traps Tab in the dialog and closes from any focused child', async () => {
    const { trigger } = renderPalette()
    const { input, user } = await openFromTrigger(trigger)
    const closeButton = screen.getByRole('button', { name: '关闭命令面板' })

    await user.tab({ shift: true })
    expect(closeButton).toHaveFocus()
    await user.tab()
    expect(input).toHaveFocus()

    closeButton.focus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })
})

describe('CommandPalette results and keyboard model', () => {
  it('reuses ranked search results and supports Arrow/Home/End/Enter with active scrolling', async () => {
    const actions = createActions()
    mocks.useWorkspaceActions.mockReturnValue(actions)
    const { trigger } = renderPalette()
    const { input, user } = await openFromTrigger(trigger)

    await user.type(input, '文本')
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(2))
    const options = screen.getAllByRole('option')
    expect(within(options[0]).getByText('文本手术刀')).toBeInTheDocument()
    expect(within(options[1]).getByText('代码 Diff 对比')).toBeInTheDocument()

    const scrollSpy = vi.mocked(HTMLElement.prototype.scrollIntoView)
    scrollSpy.mockClear()
    await user.keyboard('{End}')
    expect(selectedOption()).toBe(options.at(-1))
    await waitFor(() => expect(scrollSpy).toHaveBeenCalled())
    await user.keyboard('{ArrowDown}')
    expect(selectedOption()).toBe(options[0])
    await user.keyboard('{ArrowUp}')
    expect(selectedOption()).toBe(options.at(-1))
    await user.keyboard('{Home}')
    expect(selectedOption()).toBe(options[0])
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/tools/text'))
    expect(actions.recordRecent).toHaveBeenCalledWith({ kind: 'tool', id: toolId('text') })
  })

  it('renders labelled groups, fills quotas after stale/duplicate filtering, and keeps options out of Tab order', async () => {
    const document = documentWithSites(18)
    const missingRef: ResourceRefV2 = { kind: 'site', id: uuid(999) }
    document.favorites = [
      { ref: missingRef, createdAt: NOW },
      { ref: { kind: 'site', id: uuid(100) }, createdAt: NOW },
      { ref: { kind: 'site', id: uuid(100) }, createdAt: NOW },
      ...Array.from({ length: 6 }, (_, index) => ({
        ref: { kind: 'site' as const, id: uuid(101 + index) },
        createdAt: NOW,
      })),
      { ref: { kind: 'tool', id: toolId('network') }, createdAt: NOW },
    ]
    document.recents = [
      { ref: { kind: 'site', id: uuid(100) }, openedAt: NOW },
      { ref: { kind: 'tool', id: toolId('network') }, openedAt: NOW },
      { ref: missingRef, openedAt: NOW },
      { ref: { kind: 'tool', id: toolId('security') }, openedAt: NOW },
      ...Array.from({ length: 9 }, (_, index) => ({
        ref: { kind: 'site' as const, id: uuid(107 + index) },
        openedAt: NOW,
      })),
    ]
    mocks.useWorkspaceState.mockReturnValue(workspaceState(document))
    const { trigger } = renderPalette(document)
    const { input } = await openFromTrigger(trigger)

    const favorites = screen.getByRole('group', { name: '收藏' })
    const recents = screen.getByRole('group', { name: '最近使用' })
    const tools = screen.getByRole('group', { name: '常用工具' })
    expect(within(favorites).getAllByRole('option')).toHaveLength(8)
    expect(within(recents).getAllByRole('option')).toHaveLength(10)
    expect(within(tools).getAllByRole('option')).toHaveLength(6)
    screen.getAllByRole('option').forEach((option) => expect(option).toHaveAttribute('tabindex', '-1'))
    expect(input).toHaveAttribute('aria-controls', 'command-results')
    expect(input.getAttribute('aria-activedescendant')).toBe(selectedOption()?.id)
  })

  it('offers only clear and add-site recovery when no result is found', async () => {
    const openSpy = vi.spyOn(window, 'open')
    const { trigger } = renderPalette()
    const { input, user } = await openFromTrigger(trigger)

    await user.type(input, 'definitely-no-private-search-result')
    const title = await screen.findByText('没有找到匹配项')
    const emptyState = title.closest('.command-empty') as HTMLElement
    await user.click(within(emptyState).getByRole('button', { name: '清除搜索' }))
    await waitFor(() => expect(screen.queryByText('没有找到匹配项')).not.toBeInTheDocument())

    await user.type(input, 'still-no-private-search-result')
    const nextEmptyState = (await screen.findByText('没有找到匹配项')).closest(
      '.command-empty',
    ) as HTMLElement
    await user.click(within(nextEmptyState).getByRole('button', { name: '新增网站' }))

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/navigation?add=site'))
    expect(openSpy).not.toHaveBeenCalled()
  })
})

describe('CommandPalette command execution', () => {
  it('records a tool only after internal navigation resolves and stays open when it rejects', async () => {
    const actions = createActions()
    let resolveNavigation: (() => void) | undefined
    mocks.navigate.mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveNavigation = resolve }),
    )
    mocks.useWorkspaceActions.mockReturnValue(actions)
    const { trigger } = renderPalette()
    const { input, user } = await openFromTrigger(trigger)

    await user.type(input, 'JSON / YAML 专业版')
    await waitFor(() => expect(selectedOption()).toHaveTextContent('JSON / YAML 专业版'))
    await user.keyboard('{Enter}')
    expect(actions.recordRecent).not.toHaveBeenCalled()
    resolveNavigation?.()
    await waitFor(() => expect(actions.recordRecent).toHaveBeenCalledOnce())

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    mocks.navigate.mockRejectedValueOnce(new Error('route failed'))
    openCommandPalette()
    const reopenedInput = await screen.findByRole('combobox')
    await user.type(reopenedInput, 'JSON / YAML 专业版')
    await waitFor(() => expect(selectedOption()).toHaveTextContent('JSON / YAML 专业版'))
    vi.mocked(actions.recordRecent).mockClear()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(2))
    expect(actions.recordRecent).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('does not record or close when a website popup is blocked', async () => {
    const actions = createActions()
    mocks.useWorkspaceActions.mockReturnValue(actions)
    const document = documentWithSites()
    mocks.useWorkspaceState.mockReturnValue(workspaceState(document))
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    const { trigger } = renderPalette(document)
    const { input, user } = await openFromTrigger(trigger)

    await user.type(input, 'Example Docs')
    await waitFor(() => expect(selectedOption()).toHaveTextContent('Example Docs'))
    await user.keyboard('{Enter}')

    expect(openSpy).toHaveBeenCalledWith('about:blank', '_blank', 'noopener,noreferrer')
    expect(actions.recordRecent).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('openExternalSite safety boundary', () => {
  it('clears opener before navigating and uses noopener/noreferrer window features', () => {
    const popup = fakePopup()
    const replace = vi.mocked(popup.location.replace)
    replace.mockImplementation(() => expect(popup.opener).toBeNull())
    const opener = vi.fn(() => popup)

    expect(openExternalSite('https://example.com' as SafeHttpUrl, opener)).toBe(true)
    expect(opener).toHaveBeenCalledWith('about:blank', '_blank', 'noopener,noreferrer')
    expect(replace).toHaveBeenCalledWith('https://example.com')
  })

  it('returns false for a closed popup or opener/location failures and closes a partial popup', () => {
    const closed = { ...fakePopup(), closed: true } as Window
    expect(openExternalSite('https://example.com' as SafeHttpUrl, () => closed)).toBe(false)

    const replaceFailure = fakePopup(vi.fn(() => { throw new Error('replace failed') }))
    expect(openExternalSite('https://example.com' as SafeHttpUrl, () => replaceFailure)).toBe(false)
    expect(replaceFailure.close).toHaveBeenCalled()

    const openerFailure = fakePopup()
    Object.defineProperty(openerFailure, 'opener', {
      configurable: true,
      set: () => { throw new Error('opener failed') },
    })
    expect(openExternalSite('https://example.com' as SafeHttpUrl, () => openerFailure)).toBe(false)
    expect(openerFailure.close).toHaveBeenCalled()
  })
})
