import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import SecurityTools from './SecurityTools'

const generateKey = vi.fn()
const exportKey = vi.fn()
const importKey = vi.fn()
const sign = vi.fn()
const fetchSpy = vi.fn()

beforeEach(() => {
  generateKey.mockResolvedValue({
    publicKey: { type: 'public' } as CryptoKey,
    privateKey: { type: 'private' } as CryptoKey,
  })
  exportKey.mockImplementation(async (format: KeyFormat) => (
    format === 'spki'
      ? new Uint8Array([1, 2, 3]).buffer
      : new Uint8Array([4, 5, 6]).buffer
  ))
  importKey.mockResolvedValue({ type: 'secret' } as CryptoKey)
  sign.mockResolvedValue(new Uint8Array([0, 15, 255]).buffer)
  vi.stubGlobal('crypto', {
    subtle: { generateKey, exportKey, importKey, sign },
  })
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'clipboard')
})

describe('SecurityTools', () => {
  it('generates at least 2048-bit RSA keys with Web Crypto and handles sensitive-key copy and clear', async () => {
    const user = userEvent.setup()
    const clipboardWrite = vi.spyOn(navigator.clipboard, 'writeText')
    render(<SecurityTools />)

    const bitSelect = screen.getByRole('combobox', { name: '密钥长度（位）' })
    expect(bitSelect).toHaveValue('2048')
    expect(within(bitSelect).queryByRole('option', { name: /1024/ })).not.toBeInTheDocument()
    expect(screen.getByText(/所有输入和计算仅在当前浏览器本地处理/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '生成 RSA 密钥对' }))

    expect(await screen.findByRole('region', { name: '公钥' })).toHaveTextContent('BEGIN PUBLIC KEY')
    expect(screen.getByRole('region', { name: '私钥（敏感）' })).toHaveTextContent('BEGIN PRIVATE KEY')
    expect(screen.getByText(/私钥属于敏感数据/)).toBeInTheDocument()
    expect(generateKey).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'RSA-OAEP',
        modulusLength: 2048,
        hash: 'SHA-256',
      }),
      true,
      ['encrypt', 'decrypt'],
    )

    await user.click(screen.getByRole('button', { name: '复制私钥' }))
    expect(clipboardWrite).toHaveBeenCalledWith(expect.stringContaining('BEGIN PRIVATE KEY'))
    expect(screen.getByText(/私钥已复制；请尽快粘贴到安全位置/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空密钥对' }))
    expect(screen.getByRole('region', { name: '私钥（敏感）' })).toHaveTextContent('生成后显示 PKCS#8 PEM 私钥')
    expect(screen.getByRole('button', { name: '复制私钥' })).toBeDisabled()
    expect(screen.getByText(/密钥已从页面清空/)).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('supports 4096-bit generation and reports Web Crypto failures accessibly', async () => {
    const user = userEvent.setup()
    render(<SecurityTools />)

    await user.selectOptions(screen.getByRole('combobox', { name: '密钥长度（位）' }), '4096')
    generateKey.mockRejectedValueOnce(new Error('not supported'))
    await user.click(screen.getByRole('button', { name: '生成 RSA 密钥对' }))

    expect(generateKey).toHaveBeenCalledWith(
      expect.objectContaining({ modulusLength: 4096 }),
      true,
      ['encrypt', 'decrypt'],
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('密钥生成失败')
  })

  it('computes HMAC through Web Crypto and clears the secret and result', async () => {
    const user = userEvent.setup()
    render(<SecurityTools />)

    const section = screen.getByRole('heading', { name: 'HMAC-SHA256 生成器' }).closest('section')
    expect(section).not.toBeNull()
    const scope = within(section!)
    await user.type(scope.getByLabelText('文本'), 'hello')
    await user.type(scope.getByLabelText('密钥（敏感）'), 'secret')
    await user.click(scope.getByRole('button', { name: '生成 HMAC' }))

    expect(await scope.findByRole('region', { name: 'HMAC-SHA256 结果' })).toHaveTextContent('000fff')
    expect(importKey).toHaveBeenCalledOnce()
    expect(importKey.mock.calls[0][0]).toBe('raw')
    expect(Array.from(importKey.mock.calls[0][1] as Uint8Array)).toEqual([115, 101, 99, 114, 101, 116])
    expect(importKey.mock.calls[0].slice(2)).toEqual([
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    ])
    expect(sign).toHaveBeenCalledOnce()
    expect(sign.mock.calls[0][0]).toBe('HMAC')

    await user.click(scope.getByRole('button', { name: '清空' }))
    expect(scope.getByLabelText('文本')).toHaveValue('')
    expect(scope.getByLabelText('密钥（敏感）')).toHaveValue('')
    expect(scope.getByRole('region', { name: 'HMAC-SHA256 结果' })).toHaveTextContent('输入文本和密钥后生成十六进制 HMAC')
    expect(scope.getByText(/HMAC 文本、密钥和结果已从页面清空/)).toBeInTheDocument()
  })
})
