import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { WorkspaceProvider, useWorkspaceState } from '../contexts/WorkspaceContext'
import { MemoryWorkspaceStorage } from '../services/workspace-storage'
import type { ISODateTime, NavConfigV2, UUID } from '../types/workspace'
import Navigation from './Navigation'

const NOW = '2026-07-28T05:30:00.000Z' as ISODateTime

function uuid(value: number): UUID {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, '0')}` as UUID
}

function initialDocument(): NavConfigV2 {
  return {
    schemaVersion: 2,
    configId: uuid(1),
    revision: 3,
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
            name: 'Alpha',
            url: 'https://alpha.example.com',
            description: '第一个网站',
            order: 0,
            createdAt: NOW,
            updatedAt: NOW,
          },
          {
            id: uuid(4),
            name: 'Beta',
            url: 'https://beta.example.com',
            description: '第二个网站',
            order: 1,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
      {
        id: uuid(5),
        name: '资料',
        order: 1,
        createdAt: NOW,
        updatedAt: NOW,
        links: [
          {
            id: uuid(6),
            name: 'Gamma',
            url: 'https://gamma.example.com',
            description: '第三个网站',
            order: 0,
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
      },
    ],
    favorites: [
      { ref: { kind: 'site', id: uuid(4) }, createdAt: NOW },
    ],
    recents: [
      { ref: { kind: 'site', id: uuid(4) }, openedAt: NOW },
    ],
  }
}

function sequentialIds(start = 100): () => string {
  let next = start
  return () => uuid(next++)
}

function WorkspaceProbe() {
  const { document } = useWorkspaceState()
  return <output data-testid="workspace-document">{JSON.stringify(document)}</output>
}

function renderNavigation(route = '/navigation') {
  render(
    <MemoryRouter initialEntries={[route]}>
      <WorkspaceProvider
        userId="personal-user"
        storage={new MemoryWorkspaceStorage()}
        initialDocument={initialDocument()}
        now={() => NOW}
        newId={sequentialIds()}
      >
        <Navigation />
        <WorkspaceProbe />
      </WorkspaceProvider>
    </MemoryRouter>,
  )
}

async function readyDocument(): Promise<NavConfigV2> {
  await screen.findByRole('heading', { name: '我的导航' })
  return JSON.parse(screen.getByTestId('workspace-document').textContent || 'null') as NavConfigV2
}

function currentDocument(): NavConfigV2 {
  return JSON.parse(screen.getByTestId('workspace-document').textContent || 'null') as NavConfigV2
}

describe('Navigation', () => {
  it('renders page content without nesting another main landmark', async () => {
    renderNavigation()
    await readyDocument()

    expect(document.querySelector('main')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('deletes the filtered stable-ID site, cleans its references, and restores the full snapshot', async () => {
    const user = userEvent.setup()
    renderNavigation()
    await readyDocument()

    await user.type(screen.getByRole('searchbox', { name: '筛选网站' }), 'Beta')
    await user.click(screen.getByRole('button', { name: '编辑布局' }))
    expect(screen.getByText(/清除筛选后可拖拽排序/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '拖动 Beta 调整位置' })).toBeDisabled()

    await user.click(screen.getByLabelText('管理 Beta'))
    await user.click(screen.getByRole('button', { name: /^删除$/ }))
    const dialog = screen.getByRole('dialog', { name: '删除网站“Beta”？' })
    await user.click(within(dialog).getByRole('button', { name: '删除网站' }))

    await waitFor(() => {
      const document = currentDocument()
      expect(document.categories[0].links.map((link) => link.name)).toEqual(['Alpha'])
      expect(document.favorites).toHaveLength(0)
      expect(document.recents).toHaveLength(0)
    })
    expect(screen.getByText('已删除网站“Beta”')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => {
      const document = currentDocument()
      expect(document.categories[0].links.map((link) => link.name)).toEqual(['Alpha', 'Beta'])
      expect(document.favorites[0].ref.id).toBe(uuid(4))
      expect(document.recents[0].ref.id).toBe(uuid(4))
    })
  })

  it('moves a site through the non-drag category control while preserving its ID and supports undo', async () => {
    const user = userEvent.setup()
    renderNavigation()
    await readyDocument()

    await user.click(screen.getByRole('button', { name: '编辑布局' }))
    await user.click(screen.getByLabelText('管理 Alpha'))
    await user.selectOptions(screen.getByRole('combobox', { name: '移动 Alpha 到分类' }), uuid(5))

    await waitFor(() => {
      const document = currentDocument()
      expect(document.categories[0].links.map((link) => link.id)).toEqual([uuid(4)])
      expect(document.categories[1].links.map((link) => link.id)).toEqual([uuid(6), uuid(3)])
    })
    expect(screen.getByText('已将“Alpha”移至“资料”')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => {
      expect(currentDocument().categories[0].links.map((link) => link.id)).toEqual([uuid(3), uuid(4)])
    })
  })

  it('opens the add-site flow from ?add=site and requires an existing controlled category', async () => {
    renderNavigation('/navigation?add=site')
    await readyDocument()

    const dialog = await screen.findByRole('dialog', { name: '新增网站' })
    const category = within(dialog).getByRole('combobox', { name: '所属分类' })
    expect(category).toHaveValue(uuid(2))
    expect(within(category).getAllByRole('option').map((option) => option.textContent)).toEqual([
      '请选择分类',
      '常用',
      '资料',
    ])
  })

  it('uses custom dialogs for category editing and never depends on native prompt or confirm', async () => {
    const user = userEvent.setup()
    renderNavigation()
    await readyDocument()

    await user.click(screen.getByRole('button', { name: '编辑布局' }))
    await user.click(screen.getByRole('button', { name: '编辑分类 常用' }))
    const dialog = screen.getByRole('dialog', { name: '编辑分类' })
    const name = within(dialog).getByRole('textbox', { name: '分类名称' })
    await user.clear(name)
    await user.type(name, '每日')
    await user.click(within(dialog).getByRole('button', { name: '保存分类' }))

    await waitFor(() => expect(currentDocument().categories[0].name).toBe('每日'))
    expect(screen.queryByRole('dialog', { name: '编辑分类' })).not.toBeInTheDocument()
  })

  it('handles empty search, category creation, non-drag sorting, deletion, and undo', async () => {
    const user = userEvent.setup()
    renderNavigation()
    await readyDocument()

    const search = screen.getByRole('searchbox', { name: '筛选网站' })
    await user.type(search, 'no-site-matches-this')
    expect(screen.getByRole('heading', { name: '没有匹配的网站' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: '清除筛选' })[1])
    expect(search).toHaveValue('')

    await user.click(screen.getByRole('button', { name: '编辑布局' }))
    await user.click(screen.getByRole('button', { name: '下移分类 常用' }))
    await waitFor(() => {
      expect(currentDocument().categories.map((category) => category.id)).toEqual([uuid(5), uuid(2)])
    })
    await user.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => {
      expect(currentDocument().categories.map((category) => category.id)).toEqual([uuid(2), uuid(5)])
    })

    await user.click(screen.getByRole('button', { name: '新增分类' }))
    const createDialog = screen.getByRole('dialog', { name: '新增分类' })
    const categoryName = within(createDialog).getByRole('textbox', { name: '分类名称' })
    fireEvent.change(categoryName, { target: { value: 'x'.repeat(81) } })
    await user.click(within(createDialog).getByRole('button', { name: '创建分类' }))
    expect(within(createDialog).getByRole('alert')).toHaveTextContent('分类名称不能超过 80 个字符')
    await user.clear(categoryName)
    await user.type(categoryName, '临时')
    await user.click(within(createDialog).getByRole('button', { name: '创建分类' }))
    await waitFor(() => {
      expect(currentDocument().categories.map((category) => category.name)).toContain('临时')
    })

    await user.click(screen.getByRole('button', { name: '删除分类 临时' }))
    const deleteDialog = screen.getByRole('dialog', { name: '删除分类“临时”？' })
    await user.click(within(deleteDialog).getByRole('button', { name: '删除分类' }))
    await waitFor(() => {
      expect(currentDocument().categories.map((category) => category.name)).not.toContain('临时')
    })
    await user.click(screen.getByRole('button', { name: '撤销' }))
    await waitFor(() => {
      expect(currentDocument().categories.map((category) => category.name)).toContain('临时')
    })
  })
})
