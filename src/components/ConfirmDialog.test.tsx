import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ConfirmDialog } from './ConfirmDialog'

function ConfirmHarness({
  onCancel = vi.fn(),
  onConfirm = vi.fn(),
}: {
  onCancel?: () => void
  onConfirm?: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>打开删除确认</button>
      <ConfirmDialog
        open={open}
        title="删除网站"
        description="将从导航中删除 Example。"
        confirmLabel="删除网站"
        onCancel={() => {
          onCancel()
          setOpen(false)
        }}
        onConfirm={onConfirm}
      />
    </>
  )
}

describe('ConfirmDialog', () => {
  it('exposes an accessible labelled dialog and initially focuses cancel', async () => {
    render(
      <ConfirmDialog
        open
        title="删除分类"
        description="该分类包含 3 个网站。"
        confirmLabel="删除分类"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: '删除分类' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('该分类包含 3 个网站。')
    await waitFor(() => expect(screen.getByRole('button', { name: '取消' })).toHaveFocus())
  })

  it('closes with Escape and restores focus to the trigger', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmHarness onCancel={onCancel} />)

    const trigger = screen.getByRole('button', { name: '打开删除确认' })
    await user.click(trigger)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        open
        title="删除网站"
        description="确认删除。"
        confirmLabel="删除网站"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const cancel = screen.getByRole('button', { name: '取消' })
    const confirm = screen.getByRole('button', { name: '删除网站' })
    await waitFor(() => expect(cancel).toHaveFocus())

    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
  })

  it('calls the concrete confirmation action once', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        open
        title="删除网站"
        description="确认删除 Example。"
        confirmLabel="删除网站"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await user.click(screen.getByRole('button', { name: '删除网站' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('blocks dismissal and duplicate confirmation while submitting', async () => {
    let finish: (() => void) | undefined
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        open
        title="删除网站"
        description="确认删除。"
        confirmLabel="删除网站"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    const confirm = screen.getByRole('button', { name: '删除网站' })
    await user.click(confirm)
    expect(confirm).toBeDisabled()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    await user.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await act(async () => finish?.())
    await waitFor(() => expect(confirm).not.toBeDisabled())
  })

  it('surfaces a safe retry message when asynchronous confirmation fails', async () => {
    const user = userEvent.setup()
    render(
      <ConfirmDialog
        open
        title="删除网站"
        description="确认删除。"
        confirmLabel="删除网站"
        onCancel={vi.fn()}
        onConfirm={() => Promise.reject(new Error('secret backend detail'))}
      />,
    )

    await user.click(screen.getByRole('button', { name: '删除网站' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('操作失败，请重试。')
    expect(screen.queryByText(/secret backend detail/i)).not.toBeInTheDocument()
  })
})
