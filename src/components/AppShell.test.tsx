import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { TOOL_REGISTRY } from '../config/tools'
import { OPEN_COMMAND_PALETTE_EVENT } from '../domain/command-palette'
import { AppHeader } from './AppHeader'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  it('renders the two workspace destinations and all registered tools from one registry', () => {
    render(
      <MemoryRouter>
        <Sidebar userEmail="owner@example.com" />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '我的导航' })).toBeInTheDocument()
    TOOL_REGISTRY.forEach((tool) => {
      expect(screen.getByRole('link', { name: tool.title })).toHaveAttribute('href', tool.path)
    })
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
  })

  it('exposes collapse, close and sign-out controls with accessible names', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onCollapse = vi.fn()
    const onSignOut = vi.fn()
    render(
      <MemoryRouter>
        <Sidebar
          mobileOpen
          onCloseMobile={onClose}
          onToggleCollapsed={onCollapse}
          onSignOut={onSignOut}
        />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '折叠侧栏' }))
    await user.click(screen.getByRole('button', { name: '退出登录' }))
    await user.click(screen.getAllByRole('button', { name: '关闭导航菜单' })[0])

    expect(onCollapse).toHaveBeenCalledOnce()
    expect(onSignOut).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('AppHeader', () => {
  it('derives the page title from the tool registry and opens the shared command palette', async () => {
    const user = userEvent.setup()
    const opened = vi.fn()
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, opened)
    render(
      <MemoryRouter initialEntries={['/tools/json']}>
        <AppHeader onToggleNavigation={vi.fn()} syncLabel="待同步" syncTone="warning" />
      </MemoryRouter>,
    )

    expect(screen.getByText('JSON / YAML 专业版')).toHaveClass('app-header-title')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: '同步状态：待同步' })).toBeInTheDocument()
    const commandTrigger = screen.getByRole('button', { name: '搜索网站、工具或命令' })
    expect(commandTrigger).toHaveAttribute('aria-haspopup', 'dialog')
    await user.click(commandTrigger)
    expect(opened).toHaveBeenCalledOnce()
    window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, opened)
  })

  it('opens responsive navigation from the menu button', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <MemoryRouter>
        <AppHeader onToggleNavigation={onToggle} />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '打开导航菜单' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})

describe('MobileNav', () => {
  it('provides five touch destinations and delegates the three action entries', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn()
    const onTools = vi.fn()
    const onMore = vi.fn()
    render(
      <MemoryRouter>
        <MobileNav onOpenSearch={onSearch} onOpenTools={onTools} onOpenMore={onMore} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '首页' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: '导航' })).toHaveAttribute('href', '/navigation')
    await user.click(screen.getByRole('button', { name: '搜索' }))
    await user.click(screen.getByRole('button', { name: '工具' }))
    await user.click(screen.getByRole('button', { name: '更多' }))

    expect(onSearch).toHaveBeenCalledOnce()
    expect(onTools).toHaveBeenCalledOnce()
    expect(onMore).toHaveBeenCalledOnce()
  })
})
