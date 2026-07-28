import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import EncodeTools from './EncodeTools'

const fetchSpy = vi.fn()

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('EncodeTools', () => {
  it('encodes UTF-8 Base64 locally and provides copy and clear feedback', async () => {
    const user = userEvent.setup()
    const clipboardWrite = vi.spyOn(navigator.clipboard, 'writeText')
    render(<EncodeTools />)

    expect(screen.getByText(/所有输入和转换仅在当前浏览器本地处理/)).toBeInTheDocument()
    const section = screen.getByRole('heading', { name: 'Base64 转换' }).closest('section')
    expect(section).not.toBeNull()
    const scope = within(section!)

    await user.type(scope.getByLabelText('文本或 Base64'), '你好')
    await user.click(scope.getByRole('button', { name: '编码' }))

    const output = scope.getByRole('region', { name: '转换结果' })
    expect(output).toHaveTextContent('5L2g5aW9')
    expect(scope.getByRole('status')).toHaveTextContent('Base64 编码完成')
    await user.click(scope.getByRole('button', { name: '复制结果' }))
    expect(clipboardWrite).toHaveBeenCalledWith('5L2g5aW9')
    expect(scope.getByText('Base64 结果已复制。')).toBeInTheDocument()

    await user.clear(scope.getByLabelText('文本或 Base64'))
    await user.type(scope.getByLabelText('文本或 Base64'), '5L2g5aW9')
    await user.click(scope.getByRole('button', { name: '解码' }))
    expect(scope.getByRole('region', { name: '转换结果' })).toHaveTextContent('你好')
    expect(scope.getByText('Base64 解码完成。')).toBeInTheDocument()

    await user.click(scope.getByRole('button', { name: '清空' }))
    expect(scope.getByLabelText('文本或 Base64')).toHaveValue('')
    expect(scope.getByRole('region', { name: '转换结果' })).toHaveTextContent('输入 UTF-8 文本或标准 Base64 后开始转换')
    expect(scope.getByRole('status')).toHaveTextContent('Base64 输入和结果已清空')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('reports malformed URL and Base64 input as accessible errors', async () => {
    const user = userEvent.setup()
    render(<EncodeTools />)

    const urlSection = screen.getByRole('heading', { name: 'URL Encode / Decode' }).closest('section')
    const base64Section = screen.getByRole('heading', { name: 'Base64 转换' }).closest('section')
    expect(urlSection).not.toBeNull()
    expect(base64Section).not.toBeNull()

    await user.type(within(urlSection!).getByLabelText('URL 或文本'), '%E0%A4%A')
    await user.click(within(urlSection!).getByRole('button', { name: '解码' }))
    expect(within(urlSection!).getByRole('alert')).toHaveTextContent('百分号编码是否完整')

    await user.type(within(base64Section!).getByLabelText('文本或 Base64'), 'not base64!')
    await user.click(within(base64Section!).getByRole('button', { name: '解码' }))
    expect(within(base64Section!).getByRole('alert')).toHaveTextContent('有效的 Base64 UTF-8 文本')

    await user.clear(within(base64Section!).getByLabelText('文本或 Base64'))
    await user.type(within(base64Section!).getByLabelText('文本或 Base64'), '/w==')
    await user.click(within(base64Section!).getByRole('button', { name: '解码' }))
    expect(within(base64Section!).getByRole('alert')).toHaveTextContent('有效的 Base64 UTF-8 文本')
  })

  it('labels JWT output as decode-only and never claims signature verification', async () => {
    const user = userEvent.setup()
    const token = [
      encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
      encodeBase64Url(JSON.stringify({ sub: '123', name: '测试' })),
      'untrusted-signature',
    ].join('.')
    render(<EncodeTools />)

    const section = screen.getByRole('heading', { name: 'JWT 解码器' }).closest('section')
    expect(section).not.toBeNull()
    const scope = within(section!)
    expect(scope.getByText(/仅解码，不验签/)).toBeInTheDocument()
    expect(scope.queryByText(/HMAC256|验签功能/)).not.toBeInTheDocument()

    await user.type(scope.getByLabelText('JWT 字符串'), token)
    await user.click(scope.getByRole('button', { name: '仅解码 Token' }))

    expect(scope.getByRole('region', { name: '解码结果（未验签）' })).toHaveTextContent('"name": "测试"')
    expect(scope.getByRole('status')).toHaveTextContent('尚未验证签名与可信度')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('shows an accessible error for malformed JWT input', async () => {
    const user = userEvent.setup()
    render(<EncodeTools />)

    const section = screen.getByRole('heading', { name: 'JWT 解码器' }).closest('section')
    expect(section).not.toBeNull()
    const scope = within(section!)
    await user.type(scope.getByLabelText('JWT 字符串'), 'not-a-token')
    await user.click(scope.getByRole('button', { name: '仅解码 Token' }))
    expect(scope.getByRole('alert')).toHaveTextContent('JWT 格式无效')
  })
})
