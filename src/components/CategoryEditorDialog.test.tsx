import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CategoryEditorDialog } from './CategoryEditorDialog'

describe('CategoryEditorDialog', () => {
  it('trims a valid name and reports a rejected save without closing', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(() => false)
    render(<CategoryEditorDialog mode="create" onCancel={vi.fn()} onSave={onSave} />)

    const name = screen.getByRole('textbox', { name: '分类名称' })
    await user.type(name, '  常用服务  ')
    await user.click(screen.getByRole('button', { name: '创建分类' }))

    expect(onSave).toHaveBeenCalledWith('常用服务')
    expect(screen.getByRole('alert')).toHaveTextContent('暂时无法保存')
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(name, ' A')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('validates blank and oversized names before invoking the mutation', () => {
    const onSave = vi.fn(() => true)
    render(<CategoryEditorDialog mode="create" onCancel={vi.fn()} onSave={onSave} />)

    const name = screen.getByRole('textbox', { name: '分类名称' })
    fireEvent.submit(name.closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('请输入分类名称')

    fireEvent.change(name, { target: { value: 'x'.repeat(81) } })
    fireEvent.submit(name.closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('不能超过 80 个字符')
    expect(onSave).not.toHaveBeenCalled()
    expect(name).toHaveFocus()
  })

  it('supports close, Escape, and backdrop cancellation without treating panel clicks as dismissal', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const view = render(
      <CategoryEditorDialog
        mode="edit"
        initialName="资料"
        onCancel={onCancel}
        onSave={() => true}
      />,
    )

    expect(screen.getByRole('heading', { name: '编辑分类' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '分类名称' })).toHaveValue('资料')

    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()

    const backdrop = view.container.querySelector('.dialog-backdrop')!
    fireEvent.mouseDown(backdrop)
    expect(onCancel).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: '关闭编辑分类' }))
    expect(onCancel).toHaveBeenCalledTimes(3)
  })

  it('keeps keyboard focus inside the modal in both directions', () => {
    render(<CategoryEditorDialog mode="create" onCancel={vi.fn()} onSave={() => true} />)

    const dialog = screen.getByRole('dialog')
    const close = screen.getByRole('button', { name: '关闭新增分类' })
    const save = screen.getByRole('button', { name: '创建分类' })

    save.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(close).toHaveFocus()

    close.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(save).toHaveFocus()

    fireEvent.keyDown(dialog, { key: 'ArrowDown' })
    expect(save).toHaveFocus()
  })
})
