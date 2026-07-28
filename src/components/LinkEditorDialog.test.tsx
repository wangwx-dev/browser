import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { NavCategoryV2, NavLinkV2 } from '../types/workspace'
import {
  LinkEditorDialog,
  type LinkEditorSubmitValue,
  type LinkEditorValue,
} from './LinkEditorDialog'

const EMPTY_VALUE: LinkEditorValue = {
  name: '',
  url: '',
  description: '',
}

const CATEGORY_ONE = '00000000-0000-4000-8000-000000000101' as NavCategoryV2['id']
const CATEGORY_TWO = '00000000-0000-4000-8000-000000000102' as NavCategoryV2['id']
const MISSING_CATEGORY = '00000000-0000-4000-8000-000000000199' as NavCategoryV2['id']
const CATEGORIES = [
  { id: CATEGORY_ONE, name: '开发资源' },
  { id: CATEGORY_TWO, name: '日常工具' },
] satisfies Pick<NavCategoryV2, 'id' | 'name'>[]

function LinkEditorHarness({ onCancel = vi.fn() }: { onCancel?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开链接编辑器</button>
      <LinkEditorDialog
        open={open}
        initialValue={EMPTY_VALUE}
        onCancel={() => {
          onCancel()
          setOpen(false)
        }}
        onSubmit={vi.fn()}
      />
    </>
  )
}

function CategorizedEditorHarness({
  onSubmit,
}: {
  onSubmit: (value: LinkEditorSubmitValue) => void
}) {
  const [categoryId, setCategoryId] = useState<NavCategoryV2['id'] | ''>(CATEGORY_ONE)
  return (
    <LinkEditorDialog
      open
      initialValue={EMPTY_VALUE}
      categories={CATEGORIES}
      selectedCategoryId={categoryId}
      onSelectedCategoryIdChange={setCategoryId}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />
  )
}

function renderEditor(
  overrides: Partial<React.ComponentProps<typeof LinkEditorDialog>> = {},
) {
  const onCancel = vi.fn()
  const onSubmit = vi.fn()
  render(
    <LinkEditorDialog
      open
      initialValue={EMPTY_VALUE}
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { onCancel, onSubmit }
}

describe('LinkEditorDialog', () => {
  it('renders labelled NavLinkV2 fields with limits and focuses the name', async () => {
    renderEditor()

    expect(screen.getByRole('dialog', { name: '新增网站' })).toHaveAccessibleDescription(
      '填写网站名称和完整网址。不会自动补全或访问该网址。',
    )
    const name = screen.getByRole('textbox', { name: '名称' })
    expect(name).toHaveAttribute('maxlength', '80')
    expect(screen.getByRole('textbox', { name: 'URL' })).toHaveAttribute('maxlength', '2048')
    expect(screen.getByRole('textbox', { name: '描述' })).toHaveAttribute('maxlength', '240')
    await waitFor(() => expect(name).toHaveFocus())
  })

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'example.com'])(
    'rejects a non-http URL without silently rewriting it: %s',
    async (unsafeUrl) => {
      const user = userEvent.setup()
      const { onSubmit } = renderEditor()

      await user.type(screen.getByRole('textbox', { name: '名称' }), 'Example')
      const url = screen.getByRole('textbox', { name: 'URL' })
      await user.type(url, unsafeUrl)
      await user.click(screen.getByRole('button', { name: '保存网站' }))

      expect(onSubmit).not.toHaveBeenCalled()
      expect(url).toHaveValue(unsafeUrl)
      expect(screen.getByText('请输入完整的 http:// 或 https:// 地址。')).toBeInTheDocument()
    },
  )

  it('reports required fields and focuses the first invalid field', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.click(screen.getByRole('button', { name: '保存网站' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('请输入网站名称。')).toBeInTheDocument()
    expect(screen.getByText('请输入网站 URL。')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '名称' })).toHaveFocus()
  })

  it('submits trimmed editable fields without manufacturing NavConfigV2 identity fields', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderEditor()

    await user.type(screen.getByRole('textbox', { name: '名称' }), '  GitHub  ')
    await user.type(screen.getByRole('textbox', { name: 'URL' }), '  https://github.com  ')
    await user.type(screen.getByRole('textbox', { name: '描述' }), '  代码托管  ')
    await user.click(screen.getByRole('button', { name: '保存网站' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'GitHub',
        url: 'https://github.com',
        description: '代码托管',
      })
    })
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('id')
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('order')
  })

  it('edits values derived from NavLinkV2 while leaving identity ownership to the caller', async () => {
    const initialValue: NavLinkV2 = {
      id: '00000000-0000-4000-8000-000000000001' as NavLinkV2['id'],
      name: 'Old title',
      url: 'https://example.com',
      description: 'Old description',
      icon: 'https://example.com/icon.png',
      order: 2,
      createdAt: '2026-07-28T00:00:00.000Z' as NavLinkV2['createdAt'],
      updatedAt: '2026-07-28T00:00:00.000Z' as NavLinkV2['updatedAt'],
    }
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(
      <LinkEditorDialog
        open
        mode="edit"
        initialValue={initialValue}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    expect(screen.getByRole('dialog', { name: '编辑网站' })).toBeInTheDocument()
    const name = screen.getByRole('textbox', { name: '名称' })
    await user.clear(name)
    await user.type(name, 'New title')
    await user.click(screen.getByRole('button', { name: '保存修改' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0]).toEqual({
      name: 'New title',
      url: 'https://example.com',
      description: 'Old description',
      icon: 'https://example.com/icon.png',
    })
  })

  it('supports a controlled category selector and returns categoryId on submit', async () => {
    const onSubmit = vi.fn<(value: LinkEditorSubmitValue) => void>()
    const user = userEvent.setup()
    render(<CategorizedEditorHarness onSubmit={onSubmit} />)

    const category = screen.getByRole('combobox', { name: '所属分类' })
    expect(category).toHaveValue(CATEGORY_ONE)
    await user.selectOptions(category, CATEGORY_TWO)
    expect(category).toHaveValue(CATEGORY_TWO)
    await user.type(screen.getByRole('textbox', { name: '名称' }), 'Example')
    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://example.com')
    await user.click(screen.getByRole('button', { name: '保存网站' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      name: 'Example',
      url: 'https://example.com',
      description: '',
      categoryId: CATEGORY_TWO,
    }))
  })

  it.each([
    ['', '请选择所属分类。'],
    [MISSING_CATEGORY, '所选分类已不存在，请重新选择。'],
  ] as const)(
    'requires a still-existing category whenever the category field is enabled: %s',
    async (selectedCategoryId, expectedError) => {
      const user = userEvent.setup()
      const { onSubmit } = renderEditor({
        categories: CATEGORIES,
        selectedCategoryId,
        onSelectedCategoryIdChange: vi.fn(),
      })

      await user.type(screen.getByRole('textbox', { name: '名称' }), 'Example')
      await user.type(screen.getByRole('textbox', { name: 'URL' }), 'https://example.com')
      await user.click(screen.getByRole('button', { name: '保存网站' }))

      expect(onSubmit).not.toHaveBeenCalled()
      expect(screen.getByText(expectedError)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: '所属分类' })).toHaveFocus()
    },
  )

  it('requests metadata only after an explicit button click', async () => {
    const onRequestMetadata = vi.fn(async () => ({
      name: 'Metadata title',
      description: 'Metadata description',
      icon: 'https://example.com/icon.png',
    }))
    const user = userEvent.setup()
    renderEditor({ onRequestMetadata })

    const url = screen.getByRole('textbox', { name: 'URL' })
    await user.type(url, 'https://example.com')
    await user.tab()
    expect(onRequestMetadata).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '识别网站信息' }))
    expect(onRequestMetadata).toHaveBeenCalledTimes(1)
    expect(onRequestMetadata).toHaveBeenCalledWith('https://example.com')
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: '名称' })).toHaveValue('Metadata title')
      expect(screen.getByRole('textbox', { name: '描述' })).toHaveValue('Metadata description')
      expect(screen.getByRole('textbox', { name: '图标 URL（可选）' })).toHaveValue(
        'https://example.com/icon.png',
      )
    })
  })

  it('does not invoke metadata for an invalid URL', async () => {
    const onRequestMetadata = vi.fn()
    const user = userEvent.setup()
    renderEditor({ onRequestMetadata })

    await user.type(screen.getByRole('textbox', { name: 'URL' }), 'javascript:alert(1)')
    await user.click(screen.getByRole('button', { name: '识别网站信息' }))

    expect(onRequestMetadata).not.toHaveBeenCalled()
    expect(screen.getByText('请输入完整的 http:// 或 https:// 地址。')).toBeInTheDocument()
  })

  it('closes with Escape and restores focus to its trigger', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<LinkEditorHarness onCancel={onCancel} />)

    const trigger = screen.getByRole('button', { name: '打开链接编辑器' })
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('traps focus between dialog controls', async () => {
    const user = userEvent.setup()
    renderEditor()

    const close = screen.getByRole('button', { name: '关闭链接编辑器' })
    const submit = screen.getByRole('button', { name: '保存网站' })
    await waitFor(() => expect(screen.getByRole('textbox', { name: '名称' })).toHaveFocus())
    close.focus()
    await user.tab({ shift: true })
    expect(submit).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
  })
})
