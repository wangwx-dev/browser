import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ToolActions,
  ToolFeedback,
  ToolOutput,
  ToolSection,
  ToolShell,
} from './ToolShell'

const writeText = vi.fn<(value: string) => Promise<void>>()

beforeEach(() => {
  writeText.mockResolvedValue(undefined)
})

function setupUser() {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  return user
}

function renderShell(actions: React.ReactNode) {
  return render(
    <ToolShell title="测试工具" description="只在本机处理。">
      <ToolSection title="转换器" description="转换输入内容。">
        {actions}
        <ToolOutput id="test-output" label="输出" value="hello" />
      </ToolSection>
    </ToolShell>,
  )
}

describe('ToolShell', () => {
  it('renders an accessible page heading, section and local-processing note', () => {
    renderShell(<ToolFeedback feedback={{ tone: 'info', message: '准备就绪。' }} />)

    expect(screen.getByRole('heading', { level: 1, name: '测试工具' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '转换器' })).toHaveTextContent('转换输入内容。')
    expect(screen.getByText('本页的数据处理和生成均在当前浏览器中完成。')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '输出' })).toHaveTextContent('hello')
    expect(screen.getByRole('status')).toHaveTextContent('准备就绪。')
  })

  it('copies text and announces success without a network request', async () => {
    const user = setupUser()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    renderShell(<ToolActions copyText="secret" copyLabel="复制测试结果" />)

    await user.click(screen.getByRole('button', { name: '复制测试结果' }))

    expect(writeText).toHaveBeenCalledWith('secret')
    expect(screen.getByRole('status')).toHaveTextContent('已复制到剪贴板。')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('runs clear and example actions with explicit feedback', async () => {
    const user = setupUser()
    const onClear = vi.fn()
    const onExample = vi.fn()
    renderShell(
      <ToolActions
        onClear={onClear}
        clearLabel="清空测试"
        onExample={onExample}
        exampleLabel="载入测试示例"
      />,
    )

    await user.click(screen.getByRole('button', { name: '清空测试' }))
    expect(onClear).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('已清空。')

    await user.click(screen.getByRole('button', { name: '载入测试示例' }))
    expect(onExample).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('示例已填入。')
  })

  it('announces a safe error when clipboard access fails', async () => {
    const user = setupUser()
    writeText.mockRejectedValueOnce(new Error('private browser detail'))
    renderShell(<ToolActions copyText="secret" copyLabel="复制测试结果" />)

    await user.click(screen.getByRole('button', { name: '复制测试结果' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('复制失败')
    expect(screen.queryByText(/private browser detail/i)).not.toBeInTheDocument()
  })

  it('disables copy when no output is available', () => {
    renderShell(<ToolActions copyText="" copyLabel="复制测试结果" />)
    expect(screen.getByRole('button', { name: '复制测试结果' })).toBeDisabled()
  })
})
